"""Framework-agnostic NeuroGrid simulation core (Python port of ``src/sim/``)."""

from .cell_meta import CELL_META, LEGEND_ORDER, is_no_go
from .grid import (
    GRID_SIZE,
    build_grid,
    cell_type_at,
    cells_of_type,
    describe_coord,
    in_bounds,
    manhattan,
    same_cell,
)
from .planner import (
    evaluate_path,
    explain_failure,
    naive_unsafe_path,
    plan_a_star,
    run_learner,
)
from .rng import mulberry32
from .scenario import HIGHLIGHT_CONTEXT, RIGHT_HAND_TREMOR, VIM_TARGET_POSITION
from .world_model import ACTIONS, action_by_id, action_for_step, legal_moves, predict_transition

__all__ = [
    "ACTIONS",
    "CELL_META",
    "GRID_SIZE",
    "HIGHLIGHT_CONTEXT",
    "LEGEND_ORDER",
    "RIGHT_HAND_TREMOR",
    "VIM_TARGET_POSITION",
    "action_by_id",
    "action_for_step",
    "build_grid",
    "cell_type_at",
    "cells_of_type",
    "describe_coord",
    "evaluate_path",
    "explain_failure",
    "in_bounds",
    "is_no_go",
    "legal_moves",
    "manhattan",
    "mulberry32",
    "naive_unsafe_path",
    "plan_a_star",
    "predict_transition",
    "run_learner",
    "same_cell",
]
