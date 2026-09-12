"""Self-host the NeuroGrid Reactor Runtime on Modal.

Reactor's hosted deploy (`reactor model deploy`) requires "serve access" on the
account. Without it, the same Runtime container can run anywhere that exposes
port 8080; this file runs it on Modal behind a `web_server` endpoint and the
React client talks to it in `local` mode via VITE_REACTOR_API_URL.

    modal deploy reactor/modal_app.py
    # -> https://<workspace>--neurogrid-reactor-runtime-serve.modal.run

WebRTC media needs a UDP path or a TURN relay. Modal only proxies HTTP, so set
a TURN relay through the optional `neurogrid-turn` Modal secret:

    TURN_SERVERS=username;credential;turn:host:3478?transport=tcp

The runtime advertises it to browsers via /ice_servers, so both sides relay.
Without it, connections only succeed when the browser can reach the container
on its server-reflexive UDP candidate, which Modal's NAT does not allow.

Synthetic, educational simulation. Not medical software.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import modal

MODEL_DIR = Path(__file__).parent / "model"
PORT = 8080
RUNTIME_VERSION = "3.2.7"

app = modal.App("neurogrid-reactor-runtime")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("fonts-dejavu-core")
    .pip_install(f"reactor-runtime=={RUNTIME_VERSION}", "numpy", "Pillow", "PyYAML")
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
        self.proc = subprocess.Popen(
            ["python", "-m", "reactor_runtime.serve"],
            cwd="/app",
        )

    @modal.exit()
    def stop(self) -> None:
        self.proc.terminate()

    @modal.web_server(PORT, startup_timeout=120)
    def serve(self) -> None:
        """Proxy Modal's HTTPS endpoint to the Runtime's HTTP/WebSocket API."""
