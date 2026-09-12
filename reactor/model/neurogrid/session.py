"""Per-session simulation state machine.

Mirrors the zustand store in ``src/state/simulationStore.ts``: same fields,
same transitions, same derived values. It has no Reactor dependency so it can
be unit-tested directly; the Reactor model wraps it and forwards commands.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from .cell_meta import CELL_META
from .grid import cell_type_at, describe_coord, same_cell
from .planner import evaluate_path, explain_failure, naive_unsafe_path, plan_a_star, run_learner
from .scenario import HIGHLIGHT_CONTEXT, RIGHT_HAND_TREMOR
from .types import LearnerResult, PathEvaluation, PlanResult, Prediction, Scenario, Vec3
from .world_model import action_for_step, predict_transition

PlanningMode = Literal["astar", "learner"]

STEP_INTERVAL_MS = 900


def build_plan(mode: PlanningMode, entry: Vec3, scenario: Scenario) -> PlanResult:
    if mode == "astar":
        return plan_a_star(entry, scenario.target)
    return run_learner(entry, scenario.target, scenario.seed)


def _initial_entry(scenario: Scenario) -> Vec3:
    return scenario.entries[1] if len(scenario.entries) > 1 else scenario.entries[0]


@dataclass
class SimulationSession:
    scenario: Scenario = RIGHT_HAND_TREMOR
    highlight_context: tuple[Vec3, ...] = HIGHLIGHT_CONTEXT
    entry: Vec3 = field(default_factory=lambda: _initial_entry(RIGHT_HAND_TREMOR))
    mode: PlanningMode = "astar"
    plan: PlanResult = field(init=False)
    step_index: int = 0
    is_running: bool = False
    has_started: bool = False
    show_failed: bool = False
    failed_path: list[Vec3] = field(init=False)
    failure_reason: str = field(init=False)

    def __post_init__(self) -> None:
        self.plan = build_plan(self.mode, self.entry, self.scenario)
        self._refresh_failed_route()

    def _refresh_failed_route(self) -> None:
        self.failed_path = naive_unsafe_path(self.entry, self.scenario.target)
        self.failure_reason = explain_failure(self.failed_path, self.scenario.target)

    # -- commands (1:1 with the zustand actions) -------------------------------

    def set_entry(self, entry: Vec3) -> None:
        if not any(same_cell(entry, candidate) for candidate in self.scenario.entries):
            raise ValueError(f"{list(entry)} is not an entry corridor")
        self.entry = entry
        self.plan = build_plan(self.mode, entry, self.scenario)
        self.step_index = 0
        self.is_running = False
        self._refresh_failed_route()

    def set_mode(self, mode: PlanningMode) -> None:
        self.mode = mode
        self.plan = build_plan(mode, self.entry, self.scenario)
        self.step_index = 0
        self.is_running = False

    def start(self) -> None:
        self.has_started = True

    def run(self) -> None:
        if not self.plan.found:
            return
        self.is_running = True
        if self.step_index >= len(self.plan.path) - 1:
            self.step_index = 0

    def pause(self) -> None:
        self.is_running = False

    def reset(self) -> None:
        self.step_index = 0
        self.is_running = False

    def step(self) -> None:
        if not self.plan.found:
            return
        self.step_index = min(self.step_index + 1, len(self.plan.path) - 1)
        self.is_running = False

    def tick(self) -> bool:
        """Advance one step while running. Returns True when the state changed."""
        if not self.is_running or not self.plan.found:
            return False
        if self.step_index >= len(self.plan.path) - 1:
            self.is_running = False
            return True
        self.step_index += 1
        return True

    def toggle_failed(self) -> None:
        self.show_failed = not self.show_failed

    # -- derived selectors ------------------------------------------------------

    @property
    def current_position(self) -> Vec3:
        if self.step_index < len(self.plan.path):
            return self.plan.path[self.step_index]
        return self.entry

    @property
    def prediction(self) -> Prediction | None:
        path = self.plan.path
        if self.step_index + 1 >= len(path):
            return None
        start, end = path[self.step_index], path[self.step_index + 1]
        action = action_for_step(start, end)
        if action is None:
            return None
        return predict_transition(start, action)

    @property
    def metrics(self) -> PathEvaluation:
        return evaluate_path(self.plan.path, self.scenario.target)

    # -- wire format ---------------------------------------------------------------

    def snapshot(self) -> dict:
        """Everything the client panels need, as JSON-safe data."""
        current = self.current_position
        prediction = self.prediction
        learner_episodes = self.plan.episodes if isinstance(self.plan, LearnerResult) else 0
        return {
            "entry": list(self.entry),
            "mode": self.mode,
            "stepIndex": self.step_index,
            "isRunning": self.is_running,
            "hasStarted": self.has_started,
            "showFailed": self.show_failed,
            "failureReason": self.failure_reason,
            "failedPath": [list(p) for p in self.failed_path],
            "plan": {
                "path": [list(p) for p in self.plan.path],
                "found": self.plan.found,
                "expanded": self.plan.expanded,
                "episodes": learner_episodes,
            },
            "metrics": self.metrics.to_dict(),
            "current": {
                "position": list(current),
                "type": cell_type_at(current),
                "color": CELL_META[cell_type_at(current)].color,
                "describe": describe_coord(current),
            },
            "prediction": prediction.to_dict() if prediction else None,
        }
