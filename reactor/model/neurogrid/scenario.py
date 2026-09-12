"""Right-hand-tremor scenario. Mirrors ``src/sim/scenario.ts``."""

from __future__ import annotations

from .grid import cells_of_type
from .types import Scenario, Vec3

VIM_TARGET_POSITION: Vec3 = (1, 1, 1)

RIGHT_HAND_TREMOR = Scenario(
    id="right-hand-tremor",
    title="Right-hand tremor — left hemisphere approach",
    summary=(
        "A synthetic right-hand tremor case. Because the modelled motor pathways "
        "cross the midline, the simulation works in the left hemisphere and "
        "highlights the left hand motor context."
    ),
    context=(
        "The conceptual tremor-network target sits at [1, 1, 1] (left, anterior, "
        "inferior). The probe must reach it from a superior entry corridor without "
        "entering eloquent motor or sensory tissue, the internal-capsule analogue, "
        "the ventricle analogue, the brainstem analogue, or the cerebellar network."
    ),
    target=VIM_TARGET_POSITION,
    entries=cells_of_type("ENT"),
    seed=20240917,
)

HIGHLIGHT_CONTEXT: tuple[Vec3, ...] = cells_of_type("MOT_HAND")
