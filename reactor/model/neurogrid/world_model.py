"""Actions and the deterministic one-step transition function.

Mirrors ``src/sim/worldModel.ts``. This *is* NeuroGrid's "world model": a
symbolic lookup, not a learned network.
"""

from __future__ import annotations

from .cell_meta import CELL_META
from .grid import cell_type_at, in_bounds
from .types import Action, ActionId, Prediction, Vec3

ACTIONS: tuple[Action, ...] = (
    Action(id="X_NEG", label="Move left", hint="x − 1", delta=(-1, 0, 0)),
    Action(id="X_POS", label="Move right", hint="x + 1", delta=(1, 0, 0)),
    Action(id="Y_NEG", label="Move anterior", hint="y − 1", delta=(0, -1, 0)),
    Action(id="Y_POS", label="Move posterior", hint="y + 1", delta=(0, 1, 0)),
    Action(id="Z_NEG", label="Move inferior", hint="z − 1", delta=(0, 0, -1)),
    Action(id="Z_POS", label="Move superior", hint="z + 1", delta=(0, 0, 1)),
)


def action_by_id(action_id: ActionId) -> Action:
    for action in ACTIONS:
        if action.id == action_id:
            return action
    raise ValueError(f"Unknown action: {action_id}")


def action_for_step(start: Vec3, end: Vec3) -> Action | None:
    for action in ACTIONS:
        if (
            start[0] + action.delta[0] == end[0]
            and start[1] + action.delta[1] == end[1]
            and start[2] + action.delta[2] == end[2]
        ):
            return action
    return None


def predict_transition(start: Vec3, action: Action) -> Prediction:
    """One action in, one predicted next state out.

    Out-of-bounds transitions resolve to OUTSIDE rather than wrapping or clamping.
    """
    to: Vec3 = (
        start[0] + action.delta[0],
        start[1] + action.delta[1],
        start[2] + action.delta[2],
    )
    within_grid = in_bounds(to)
    predicted_type = cell_type_at(to)
    meta = CELL_META[predicted_type]
    allowed = within_grid and not meta.no_go

    if not within_grid:
        rationale = "Leaves the modelled 4×4×4 volume."
    elif meta.no_go:
        rationale = f"Blocked: {meta.name} is a hard no-go constraint."
    else:
        rationale = f"Permitted: {meta.name}."

    return Prediction(
        from_=start,
        action=action,
        to=to,
        in_bounds=within_grid,
        predicted_type=predicted_type,
        risk=meta.risk,
        reward=meta.reward,
        allowed=allowed,
        rationale=rationale,
    )


def legal_moves(start: Vec3) -> list[Prediction]:
    return [
        prediction
        for prediction in (predict_transition(start, action) for action in ACTIONS)
        if prediction.allowed
    ]
