"""Proxy the public Fly HTTP service to the private Reactor Runtime."""

from __future__ import annotations

import asyncio
import os

from aiohttp import ClientSession, WSMsgType, web

RUNTIME_PORT = 8081
PUBLIC_IP = os.environ["PUBLIC_IP"]
TURN_USER = os.environ["TURN_USER"]
TURN_PASS = os.environ["TURN_PASS"]
PUBLIC_TURN_URIS = [
    f"turn:{PUBLIC_IP}:3478?transport=udp",
    f"turn:{PUBLIC_IP}:3478?transport=tcp",
]


def _rewrite_ice_payload(payload: dict) -> dict:
    for server in payload.get("ice_servers", []):
        rewritten: list[str] = []
        has_turn = False
        for uri in server.get("uris", []):
            if uri.startswith("turn:127.0.0.1:3478"):
                rewritten.extend(PUBLIC_TURN_URIS)
                has_turn = True
            else:
                rewritten.append(uri)
        if has_turn:
            server["uris"] = list(dict.fromkeys(rewritten))
            server["credentials"] = {"username": TURN_USER, "password": TURN_PASS}
    return payload


async def _proxy_request(request: web.Request) -> web.StreamResponse:
    if request.method == "GET" and request.path.endswith("/ice_servers"):
        return await _proxy_ice_servers(request)
    if request.headers.get("Upgrade", "").lower() == "websocket":
        return await _proxy_websocket(request)

    target = f"http://127.0.0.1:{RUNTIME_PORT}{request.rel_url}"
    body = await request.read()
    async with request.app["client"].request(
        request.method,
        target,
        headers=dict(request.headers),
        data=body,
        allow_redirects=False,
    ) as response:
        headers = {
            key: value
            for key, value in response.headers.items()
            if key.lower() not in {"content-length", "transfer-encoding", "connection"}
        }
        return web.Response(status=response.status, headers=headers, body=await response.read())


async def _proxy_ice_servers(request: web.Request) -> web.Response:
    if request.path == "/ice_servers":
        payload = {
            "ice_servers": [
                {
                    "uris": PUBLIC_TURN_URIS,
                    "credentials": {"username": TURN_USER, "password": TURN_PASS},
                }
            ]
        }
        return web.json_response(payload)

    target = f"http://127.0.0.1:{RUNTIME_PORT}{request.rel_url}"
    async with request.app["client"].get(target, headers=dict(request.headers)) as response:
        payload = await response.json()
        if response.status >= 400:
            return web.json_response(payload, status=response.status)
    return web.json_response(_rewrite_ice_payload(payload))


async def _proxy_websocket(request: web.Request) -> web.WebSocketResponse:
    client_ws = web.WebSocketResponse()
    await client_ws.prepare(request)
    target = f"http://127.0.0.1:{RUNTIME_PORT}{request.rel_url}"
    headers = dict(request.headers)
    for header in ("Connection", "Content-Length", "Host", "Upgrade"):
        headers.pop(header, None)

    async with request.app["client"].ws_connect(target, headers=headers) as upstream_ws:
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


async def _start() -> web.AppRunner:
    client = ClientSession()
    app = web.Application()
    app["client"] = client
    app.router.add_route("*", "/{path_info:.*}", _proxy_request)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 8080)
    await site.start()
    return runner


async def main() -> None:
    runner = await _start()
    try:
        await asyncio.Event().wait()
    finally:
        await runner.cleanup()
        await runner.app["client"].close()


if __name__ == "__main__":
    asyncio.run(main())
