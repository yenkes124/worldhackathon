"""Self-host the NeuroGrid Reactor Runtime on Modal.

Modal exposes the HTTP API through a reverse proxy on port 8080. The Runtime
listens on 127.0.0.1:8081 and uses coturn's TCP listener on localhost; clients
connect to coturn through its public Modal TCP tunnel. The proxy rewrites
/ice_servers so clients receive the public TCP tunnel URL while retaining the
per-container credential.

Media is not yet verified on Modal: STUN-only failed, the coturn TCP listener
is reachable through the tunnel, and TCP TURN allocations complete but the
Runtime-to-client media connection never reaches a live wire in the Modal
sandbox. Local Docker works with both TURN/TCP and TURN/UDP.

    modal deploy reactor/modal_app.py
    # -> https://<workspace>--neurogrid-reactor-runtime-serve.modal.run

Synthetic, educational simulation. Not medical software.
"""

from __future__ import annotations

import asyncio
import os
import secrets as token_secrets
import socket
import subprocess
import threading
from pathlib import Path

from aiohttp import ClientSession, WSMsgType, web
import modal

MODEL_DIR = Path(__file__).parent / "model"
PORT = 8080
RUNTIME_PORT = 8081
RUNTIME_VERSION = "3.2.7"

app = modal.App("neurogrid-reactor-runtime")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("fonts-dejavu-core", "coturn")
    .pip_install(
        f"reactor-runtime=={RUNTIME_VERSION}",
        "aiohttp",
        "numpy",
        "Pillow",
        "PyYAML",
    )
    .env({"PYTHONUNBUFFERED": "1", "HOST": "0.0.0.0", "PORT": str(PORT)})
    .add_local_dir(
        MODEL_DIR,
        "/app",
        ignore=["**/.venv", "**/__pycache__", "**/.pytest_cache", "**/tests", "**/.git"],
    )
)

# ICE configuration (TURN_SERVERS / STUN_SERVERS / ICE_TRANSPORT_POLICY). Must exist:
#   modal secret create neurogrid-turn TURN_SERVERS='user;cred;turn:host:3478?transport=tcp'
# or, to start with STUN only:  modal secret create neurogrid-turn ICE_TRANSPORT_POLICY=all
secrets = [modal.Secret.from_name("neurogrid-turn")]


@app.cls(
    image=image,
    cpu=2,
    memory=2048,
    secrets=secrets,
    scaledown_window=600,
    max_containers=1,
)
@modal.concurrent(max_inputs=50)
class Runtime:
    @modal.enter()
    def start(self) -> None:
        self.tunnel_context = modal.forward(3478, unencrypted=True)
        self.tunnel = self.tunnel_context.__enter__()
        self.tunnel_host, self.tunnel_port = self.tunnel.tcp_socket
        self.turn_secret = token_secrets.token_urlsafe(24)
        self.public_turn_uri = f"turn:{self.tunnel_host}:{self.tunnel_port}?transport=tcp"
        self.relay_ip = self._relay_ip()
        self.turn = subprocess.Popen(
            [
                "turnserver",
                "-n",
                "--log-file=stdout",
                "-v",
                "--listening-port=3478",
                "--listening-ip=0.0.0.0",
                f"--relay-ip={self.relay_ip}",
                "--realm=neurogrid",
                "--lt-cred-mech",
                f"--user=neurogrid:{self.turn_secret}",
                "--min-port=49152",
                "--max-port=65535",
                "--fingerprint",
                "--no-cli",
                "--no-tls",
            ],
        )
        self.proc = subprocess.Popen(
            ["python", "-m", "reactor_runtime.serve"],
            cwd="/app",
            env={
                **os.environ,
                "HOST": "127.0.0.1",
                "PORT": str(RUNTIME_PORT),
                "TURN_SERVERS": (
                    f"neurogrid;{self.turn_secret};"
                    "turn:127.0.0.1:3478?transport=tcp"
                ),
                "ICE_TRANSPORT_POLICY": "relay",
            },
        )
        self.proxy_loop = asyncio.new_event_loop()
        self.proxy_ready = threading.Event()
        self.proxy_error: BaseException | None = None
        self.proxy_thread = threading.Thread(target=self._run_proxy, daemon=True)
        self.proxy_thread.start()
        if not self.proxy_ready.wait(timeout=30):
            raise RuntimeError("reverse proxy did not start within 30 seconds")
        if self.proxy_error is not None:
            raise RuntimeError("reverse proxy failed to start") from self.proxy_error

    @staticmethod
    def _relay_ip() -> str:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.connect(("8.8.8.8", 80))
            return sock.getsockname()[0]

    @modal.exit()
    def stop(self) -> None:
        self.proc.terminate()
        self.turn.terminate()
        if self.proxy_loop.is_running():
            future = asyncio.run_coroutine_threadsafe(self._close_proxy(), self.proxy_loop)
            future.result(timeout=30)
            self.proxy_loop.call_soon_threadsafe(self.proxy_loop.stop)
            self.proxy_thread.join(timeout=30)
        self.tunnel_context.__exit__(None, None, None)

    def _run_proxy(self) -> None:
        asyncio.set_event_loop(self.proxy_loop)
        try:
            self.proxy_loop.run_until_complete(self._start_proxy())
        except BaseException as error:
            self.proxy_error = error
            self.proxy_ready.set()
            return
        self.proxy_ready.set()
        self.proxy_loop.run_forever()

    async def _start_proxy(self) -> None:
        self.proxy_client = ClientSession()
        self.proxy_app = web.Application()
        self.proxy_app.router.add_route("*", "/{path_info:.*}", self._proxy_request)
        self.proxy_runner = web.AppRunner(self.proxy_app)
        await self.proxy_runner.setup()
        self.proxy_site = web.TCPSite(self.proxy_runner, "0.0.0.0", PORT)
        await self.proxy_site.start()

    async def _close_proxy(self) -> None:
        await self.proxy_runner.cleanup()
        await self.proxy_client.close()

    async def _proxy_request(self, request: web.Request) -> web.StreamResponse:
        if request.method == "GET" and request.path.endswith("/ice_servers"):
            return await self._proxy_ice_servers(request)
        if request.headers.get("Upgrade", "").lower() == "websocket":
            return await self._proxy_websocket(request)

        target = f"http://127.0.0.1:{RUNTIME_PORT}{request.rel_url}"
        headers = dict(request.headers)
        body = await request.read()
        async with self.proxy_client.request(
            request.method,
            target,
            headers=headers,
            data=body,
            allow_redirects=False,
        ) as response:
            response_headers = {
                key: value
                for key, value in response.headers.items()
                if key.lower() not in {"content-length", "transfer-encoding", "connection"}
            }
            return web.Response(
                status=response.status,
                headers=response_headers,
                body=await response.read(),
            )

    async def _proxy_ice_servers(self, request: web.Request) -> web.Response:
        if request.path == "/ice_servers":
            payload = {
                "ice_servers": [
                    {
                        "uris": [self.public_turn_uri],
                        "credentials": {
                            "username": "neurogrid",
                            "password": self.turn_secret,
                        },
                    }
                ]
            }
        else:
            target = f"http://127.0.0.1:{RUNTIME_PORT}{request.rel_url}"
            async with self.proxy_client.get(target, headers=dict(request.headers)) as response:
                payload = await response.json()
                if response.status >= 400:
                    return web.json_response(payload, status=response.status)
        for server in payload.get("ice_servers", []):
            server["uris"] = [
                self.public_turn_uri if uri.startswith("turn:127.0.0.1:3478") else uri
                for uri in server.get("uris", [])
            ]
        return web.json_response(payload)

    async def _proxy_websocket(self, request: web.Request) -> web.WebSocketResponse:
        client_ws = web.WebSocketResponse()
        await client_ws.prepare(request)
        target = f"http://127.0.0.1:{RUNTIME_PORT}{request.rel_url}"
        headers = dict(request.headers)
        for header in ("Connection", "Content-Length", "Host", "Upgrade"):
            headers.pop(header, None)
        async with self.proxy_client.ws_connect(target, headers=headers) as upstream_ws:
            async def client_to_upstream() -> None:
                async for message in client_ws:
                    if message.type == WSMsgType.TEXT:
                        await upstream_ws.send_str(message.data)
                    elif message.type == WSMsgType.BINARY:
                        await upstream_ws.send_bytes(message.data)
                    elif message.type == WSMsgType.PING:
                        await upstream_ws.ping(message.data)
                    elif message.type == WSMsgType.PONG:
                        await upstream_ws.pong(message.data)
                    elif message.type in {WSMsgType.CLOSE, WSMsgType.ERROR}:
                        break

            async def upstream_to_client() -> None:
                async for message in upstream_ws:
                    if message.type == WSMsgType.TEXT:
                        await client_ws.send_str(message.data)
                    elif message.type == WSMsgType.BINARY:
                        await client_ws.send_bytes(message.data)
                    elif message.type == WSMsgType.PING:
                        await client_ws.ping(message.data)
                    elif message.type == WSMsgType.PONG:
                        await client_ws.pong(message.data)
                    elif message.type in {WSMsgType.CLOSE, WSMsgType.ERROR}:
                        break

            tasks = [
                asyncio.create_task(client_to_upstream()),
                asyncio.create_task(upstream_to_client()),
            ]
            await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in tasks:
                if not task.done():
                    task.cancel()
        await client_ws.close()
        return client_ws

    @modal.web_server(PORT, startup_timeout=120)
    def serve(self) -> None:
        """Proxy Modal's HTTPS endpoint to the Runtime's HTTP/WebSocket API."""
