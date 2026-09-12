"""Shared domain types for the NeuroGrid simulation core.

Mirrors ``src/sim/types.ts`` in the original TypeScript app. Everything here is
plain data: the Reactor model serialises these into ``ModelMessage`` payloads,
but the simulation core itself has no dependency on the Reactor runtime.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

Vec3 = tuple[int, int, int]

CellType = Literal[
    "ENT",
    "WM_SAFE",
    "MOT_LEG",
    "MOT_TRUNK",
    "MOT_ARM",
    "MOT_HAND",
    "MOT_FACE",
    "SENS",
    "THAL",
    "VIM_NEAR",
    "VIM_TARGET",
    "IC_AVOID",
    "VENT_AVOID",
    "BRAINSTEM_AVOID",
    "CEREB_NET",
    "OUTSIDE",
]

ActionId = Literal["X_POS", "X_NEG", "Y_POS", "Y_NEG", "Z_POS", "Z_NEG"]


@dataclass(frozen=True)
class Action:
    id: ActionId
    label: str
    hint: str
    delta: Vec3


@dataclass(frozen=True)
class CellMeta:
    type: CellType
    name: str
    description: str
    color: str
    no_go: bool
    """Hard constraint for the planner: the probe may never enter this cell."""
    risk: float
    """Synthetic 0..1 traversal risk used by the world model."""
    reward: float
    """Synthetic reward signal used by the learner demo."""


@dataclass(frozen=True)
class Cell:
    position: Vec3
    type: CellType


@dataclass(frozen=True)
class Prediction:
    from_: Vec3
    action: Action
    to: Vec3
    in_bounds: bool
    predicted_type: CellType
    risk: float
    reward: float
    allowed: bool
    rationale: str

    def to_dict(self) -> dict:
        data = asdict(self)
        data["from"] = list(data.pop("from_"))
        data["to"] = list(data["to"])
        data["action"]["delta"] = list(data["action"]["delta"])
        return data


@dataclass(frozen=True)
class Violation:
    position: Vec3
    type: CellType


@dataclass(frozen=True)
class PathEvaluation:
    steps: int
    total_risk: float
    peak_risk: float
    total_reward: float
    reaches_target: bool
    violations: tuple[Violation, ...]

    def to_dict(self) -> dict:
        return {
            "steps": self.steps,
            "total_risk": self.total_risk,
            "peak_risk": self.peak_risk,
            "total_reward": self.total_reward,
            "reaches_target": self.reaches_target,
            "violations": [
                {"position": list(v.position), "type": v.type} for v in self.violations
            ],
        }


@dataclass(frozen=True)
class PlanResult:
    path: tuple[Vec3, ...]
    found: bool
    expanded: int
    evaluation: PathEvaluation

    def to_dict(self) -> dict:
        return {
            "path": [list(p) for p in self.path],
            "found": self.found,
            "expanded": self.expanded,
            "evaluation": self.evaluation.to_dict(),
        }


@dataclass(frozen=True)
class LearnerResult(PlanResult):
    episodes: int = 0
    episode_scores: tuple[float, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict:
        data = super().to_dict()
        data["episodes"] = self.episodes
        data["episode_scores"] = list(self.episode_scores)
        return data


@dataclass(frozen=True)
class Scenario:
    id: str
    title: str
    summary: str
    context: str
    target: Vec3
    entries: tuple[Vec3, ...]
    seed: int

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "summary": self.summary,
            "context": self.context,
            "target": list(self.target),
            "entries": [list(e) for e in self.entries],
            "seed": self.seed,
        }
