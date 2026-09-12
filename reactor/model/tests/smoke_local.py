"""End-to-end smoke test against a locally running runtime (`reactor run`).

Not part of the pytest suite: it needs Docker and the model listening on
http://localhost:8080. Connects with the Python client SDK, drives the demo
flow (start -> step -> run -> set_entry -> set_mode -> toggle_failed) and
checks that video frames and SimulationState messages arrive.

    reactor run            # in reactor/model, separate terminal
    .venv/bin/python tests/smoke_local.py

Set REACTOR_API_URL to target a self-hosted runtime (e.g. the Modal URL).
"""

from __future__ import annotations

import asyncio
import os
import sys

from reactor_sdk import Reactor, ReactorStatus


async def main() -> int:
    frames: list[tuple[int, ...]] = []
    messages: list[dict] = []
    ready = asyncio.Event()

    reactor = Reactor(
        model_name="neurogrid",
        local=True,
        api_url=os.getenv("REACTOR_API_URL", "http://localhost:8080"),
    )

    @reactor.on_status(ReactorStatus.READY)
    async def on_ready(status):
        output = reactor.tracks.with_direction("recvonly").with_kind("video").one()

        @output.on_frame
        def on_frame(frame):
            frames.append(frame.shape)

        ready.set()

    @reactor.on_message
    def on_message(message):
        messages.append(message if isinstance(message, dict) else message.__dict__)

    await reactor.connect()
    await asyncio.wait_for(ready.wait(), 20)

    async def cmd(name: str, data: dict | None = None):
        reply = await reactor.send_command(name, data or {})
        print(f"{name:14s} ->", str(reply)[:160])
        return reply

    reply = await cmd("start")
    await cmd("step")
    state = await cmd("get_state")
    await cmd("set_entry", {"position": [0, 1, 3]})
    await cmd("set_mode", {"mode": "learner"})
    await cmd("toggle_failed")
    await cmd("orbit", {"yaw": 0.4, "pitch": 0.1, "zoom": 1.2})
    await cmd("hover", {"u": 0.5, "v": 0.5})
    await cmd("run")
    await asyncio.sleep(2.5)
    state = await cmd("pause")

    await asyncio.sleep(1)
    await reactor.disconnect()

    print(f"frames received: {len(frames)}  shapes: {set(frames)}")
    print(f"messages received: {len(messages)}")
    for m in messages[:4]:
        print("  ", str(m)[:200])
    ok = len(frames) > 5 and reply is not None and state is not None
    print("SMOKE OK" if ok else "SMOKE FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
