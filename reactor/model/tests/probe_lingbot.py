"""Probe: can this account open Reactor's hosted LingBot World 2 and get frames?

    REACTOR_API_KEY=rk_... .venv/bin/python tests/probe_lingbot.py [seed.jpg]

Runs ~15 s of generation (billed per second by Reactor), prints frame count
and the model's state messages. Synthetic educational demo, not medical.
"""

from __future__ import annotations

import asyncio
import os
import sys

from reactor_sdk import Reactor, ReactorStatus

PROMPT = (
    "First-person camera drifting slowly through a stylised, fictional cavern of "
    "glowing brain tissue; colour-coded regions, luminous neuron filaments. "
    "The camera moves; the scene stays still."
)


async def main(image: str) -> int:
    frames: list[tuple[int, ...]] = []
    events: list[str] = []
    ready = asyncio.Event()
    image_ok = asyncio.Event()

    reactor = Reactor(model_name="reactor/lingbot-world-2", api_key=os.environ["REACTOR_API_KEY"])

    @reactor.on_status(ReactorStatus.READY)
    async def on_ready(status):
        out = reactor.tracks.with_direction("recvonly").with_kind("video").one()

        @out.on_frame
        def on_frame(frame):
            frames.append(frame.shape)

        ready.set()

    @reactor.on_message
    def on_message(msg):
        m = msg if isinstance(msg, dict) else msg.__dict__
        events.append(f"{m.get('type')} {str(m.get('data'))[:120]}")
        if m.get("type") == "image_accepted":
            image_ok.set()

    await reactor.connect()
    await asyncio.wait_for(ready.wait(), 60)
    ref = await reactor.upload_file(image)
    await reactor.send_command("set_image", {"image": ref})
    await reactor.send_command("set_prompt", {"prompt": PROMPT})
    await reactor.send_command("set_seed", {"seed": 20240917})
    await asyncio.wait_for(image_ok.wait(), 30)
    await reactor.send_command("start", {})
    await asyncio.sleep(8)
    await reactor.send_command("set_move_longitudinal", {"move_longitudinal": "forward"})
    await asyncio.sleep(7)
    await reactor.send_command("set_move_longitudinal", {"move_longitudinal": "idle"})
    await reactor.send_command("reset", {})
    await reactor.disconnect()

    print(f"frames: {len(frames)} shapes: {set(frames)}")
    for e in events:
        print(" ", e)
    ok = len(frames) > 10
    print("PROBE OK" if ok else "PROBE FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "../../public/brain-seed.jpg")))
