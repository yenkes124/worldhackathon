"""
NeuroGrid as a Reactor model.

The "model" here is NOT a trained network: it is the deterministic symbolic
world model (grid lookup + transition function), the risk-weighted A* planner
and the seeded rollout learner ported from ``src/sim/``. Reactor Runtime gives
it what the browser app got from React/Three.js: a session, typed commands,
typed state messages and a live video track carrying the software-rendered
brain-grid scene.

Not medical software. Everything here — anatomy, coordinates, risk numbers —
is invented for an educational proof of concept.

Deploy with:  reactor model deploy
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import List, Optional

import yaml

from neurogrid.cell_meta import CELL_META, LEGEND_ORDER, meta_to_dict
from neurogrid.grid import cell_type_at
from neurogrid.render import Camera, SceneRenderer, SceneState
from neurogrid.session import STEP_INTERVAL_MS, SimulationSession
from neurogrid.types import Vec3
from reactor_runtime import (
    ClientInfo,
    CommandError,
    InputField,
    MessageField,
    ModelMessage,
    Output,
    ReactorModel,
    Video,
    connected,
    event,
    get_logger,
    session_started,
)

logger = get_logger(__name__)

# -- Tracks --------------------------------------------------------------------


class NeuroGridOutput(Output):
    """The software-rendered brain-grid scene."""

    main_video: Video


# -- Messages ------------------------------------------------------------------


class SimulationState(ModelMessage):
    """Full snapshot of the simulation after every command or tick."""

    state: dict = MessageField(description="Mirror of the original zustand store, JSON-safe.")


class ScenarioInfo(ModelMessage):
    """Static scenario + legend data, sent once per connecting client."""

    scenario: dict = MessageField(description="Title, summary, context, target, entries, seed.")
    highlight_context: List[List[int]] = MessageField(description="MOT_HAND cells.")
    legend: List[dict] = MessageField(description="Cell metadata in legend order.")
    grid: List[dict] = MessageField(description="All 64 cells: position + type.")
    step_interval_ms: int = MessageField(description="Playback interval used while running.")
    safety_notice: str = MessageField(description="Non-medical disclaimer.")


class CameraState(ModelMessage):
    """Orbit camera after a camera command."""

    yaw: float
    pitch: float
    zoom: float


class HoverInfo(ModelMessage):
    """Voxel under the pointer, or none."""

    position: Optional[List[int]] = MessageField(default=None)
    type: Optional[str] = MessageField(default=None)


SAFETY_NOTICE = (
    "Not medical software. NeuroGrid is a synthetic, educational world-model demo. "
    "It uses invented geometry and invented coordinates — no patient data, no anatomical "
    "accuracy, and no use for diagnosis, planning, or surgical guidance."
)


def _vec(value: List[int]) -> Vec3:
    if len(value) != 3:
        raise CommandError("invalid_position", "A position is three integers [x, y, z].")
    return int(value[0]), int(value[1]), int(value[2])


# -- Model ---------------------------------------------------------------------


class NeuroGridModel(ReactorModel):
    """Deterministic voxel-grid world model + planner, streamed as video."""

    fps = 12

    def load(self, config_path: Path | None) -> None:
        config = yaml.safe_load(config_path.read_text()) if config_path else {}
        width = int(config.get("width", 960))
        height = int(config.get("height", 600))
        self.renderer = SceneRenderer(width=width, height=height)
        self.session = SimulationSession()
        self.camera = Camera()
        self.hovered: Vec3 | None = None
        self._dirty = True
        logger.info("neurogrid loaded", width=width, height=height)

    # -- lifecycle ----------------------------------------------------------------

    @session_started
    async def on_session_start(self) -> None:
        self.session = SimulationSession()
        self.camera = Camera()
        self.hovered = None
        self._dirty = True

    @connected
    async def on_connect(self, client: ClientInfo) -> None:
        await client.send(self._scenario_message())
        await client.send(self._state_message())
        await client.send(self._camera_message())

    # -- helpers ------------------------------------------------------------------

    def _scenario_message(self) -> ScenarioInfo:
        return ScenarioInfo(
            scenario=self.session.scenario.to_dict(),
            highlight_context=[list(p) for p in self.session.highlight_context],
            legend=[meta_to_dict(CELL_META[t]) for t in LEGEND_ORDER],
            grid=[{"position": list(cell.position), "type": cell.type} for cell in self.renderer.cells],
            step_interval_ms=STEP_INTERVAL_MS,
            safety_notice=SAFETY_NOTICE,
        )

    def _state_message(self) -> SimulationState:
        return SimulationState(state=self.session.snapshot())

    def _camera_message(self) -> CameraState:
        return CameraState(yaw=self.camera.yaw, pitch=self.camera.pitch, zoom=self.camera.zoom)

    def _touch(self) -> SimulationState:
        self._dirty = True
        return self._state_message()

    # -- simulation commands (1:1 with the zustand store) -------------------------

    @event(name="start", description="Dismiss the intro and enter the simulation.")
    async def start(self) -> SimulationState:
        self.session.start()
        return self._touch()

    @event(name="run", description="Play the planned trajectory step by step.")
    async def run_plan(self) -> SimulationState:
        self.session.run()
        return self._touch()

    @event(name="pause", description="Pause playback.")
    async def pause(self) -> SimulationState:
        self.session.pause()
        return self._touch()

    @event(name="step", description="Advance the probe one cell along the plan.")
    async def step(self) -> SimulationState:
        self.session.step()
        return self._touch()

    @event(name="reset", description="Return the probe to the entry corridor.")
    async def reset(self) -> SimulationState:
        self.session.reset()
        return self._touch()

    @event(name="set_entry", description="Choose the entry corridor (an ENT cell).")
    async def set_entry(
        self,
        position: Optional[List[int]] = InputField(default=None, description="[x, y, z] of an ENT cell."),
    ) -> SimulationState:
        if position is None:
            raise CommandError("missing_position", "set_entry needs a position [x, y, z].")
        vec = _vec(position)
        if cell_type_at(vec) != "ENT":
            raise CommandError("not_an_entry", f"{list(vec)} is not an entry corridor.")
        self.session.set_entry(vec)
        return self._touch()

    @event(name="set_mode", description="Switch between the A* planner and the learner demo.")
    async def set_mode(
        self,
        mode: str = InputField(default="astar", choices=["astar", "learner"]),
    ) -> SimulationState:
        self.session.set_mode(mode)  # type: ignore[arg-type]
        return self._touch()

    @event(name="toggle_failed", description="Show or hide the naive unsafe direct route.")
    async def toggle_failed(self) -> SimulationState:
        self.session.toggle_failed()
        return self._touch()

    @event(name="get_state", description="Re-send the current simulation snapshot.")
    async def get_state(self) -> SimulationState:
        return self._state_message()

    @event(name="get_scenario", description="Static scenario, legend and grid data for the client panels.")
    async def get_scenario(self) -> ScenarioInfo:
        return self._scenario_message()

    # -- scene interaction (replaces OrbitControls + raycast picking) -------------

    @event(name="orbit", description="Rotate the camera by yaw/pitch deltas (radians) and scale zoom.")
    async def orbit(
        self,
        yaw: float = InputField(default=0.0, ge=-6.3, le=6.3),
        pitch: float = InputField(default=0.0, ge=-3.2, le=3.2),
        zoom: float = InputField(default=1.0, ge=0.5, le=2.0, description="Multiplier applied to zoom."),
    ) -> CameraState:
        self.camera.yaw += yaw
        self.camera.pitch += pitch
        self.camera.zoom *= zoom
        self.camera.clamp()
        self._dirty = True
        return self._camera_message()

    @event(name="reset_camera", description="Restore the default viewpoint.")
    async def reset_camera(self) -> CameraState:
        self.camera = Camera()
        self._dirty = True
        return self._camera_message()

    @event(name="hover", description="Report the pointer position over the video (0..1) to highlight a voxel.")
    async def hover(
        self,
        u: float = InputField(default=-1.0, ge=-1.0, le=1.0, description="-1 clears the hover."),
        v: float = InputField(default=-1.0, ge=-1.0, le=1.0),
    ) -> HoverInfo:
        self.hovered = None if u < 0 or v < 0 else self.renderer.pick(u, v, self.camera)
        self._dirty = True
        if self.hovered is None:
            return HoverInfo()
        return HoverInfo(position=list(self.hovered), type=cell_type_at(self.hovered))

    @event(name="click", description="Click the video (0..1). Selecting an ENT voxel changes the entry.")
    async def click(
        self,
        u: float = InputField(default=0.0, ge=0.0, le=1.0),
        v: float = InputField(default=0.0, ge=0.0, le=1.0),
    ) -> SimulationState:
        picked = self.renderer.pick(u, v, self.camera)
        if picked is not None and cell_type_at(picked) == "ENT":
            self.session.set_entry(picked)
        return self._touch()

    # -- run loop -----------------------------------------------------------------

    def _scene_state(self) -> SceneState:
        session = self.session
        return SceneState(
            entry=session.entry,
            target=session.scenario.target,
            highlight=session.highlight_context,
            planned_path=session.plan.path,
            failed_path=tuple(session.failed_path),
            show_failed=session.show_failed,
            probe=session.current_position,
            step_index=session.step_index,
            hovered=self.hovered,
        )

    async def run(self) -> None:
        frame = None
        while True:
            await self.connected.wait()
            next_tick = time.monotonic() + STEP_INTERVAL_MS / 1000
            while self.connected.is_set():
                now = time.monotonic()
                if self.session.is_running and now >= next_tick:
                    if self.session.tick():
                        self._dirty = True
                        await self.send(self._state_message())
                    next_tick = now + STEP_INTERVAL_MS / 1000
                elif not self.session.is_running:
                    next_tick = now + STEP_INTERVAL_MS / 1000

                if self._dirty or frame is None:
                    frame = self.renderer.render(self._scene_state(), self.camera)
                    self._dirty = False
                await self.emit(NeuroGridOutput(main_video=frame))
                await asyncio.sleep(0)
