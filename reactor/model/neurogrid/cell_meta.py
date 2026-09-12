"""Per-cell-type metadata. Mirrors ``src/sim/cellMeta.ts`` value-for-value."""

from __future__ import annotations

from .types import CellMeta, CellType

CELL_META: dict[CellType, CellMeta] = {
    "ENT": CellMeta(
        type="ENT",
        name="Entry corridor",
        description="Permitted synthetic entry point on the superior surface.",
        color="#22d3ee",
        no_go=False,
        risk=0.05,
        reward=0,
    ),
    "WM_SAFE": CellMeta(
        type="WM_SAFE",
        name="Safe white matter",
        description="Low-risk corridor tissue the probe may traverse.",
        color="#64748b",
        no_go=False,
        risk=0.1,
        reward=0.05,
    ),
    "MOT_LEG": CellMeta(
        type="MOT_LEG",
        name="Motor cortex — leg",
        description="Eloquent motor territory. Hard no-go in this simulation.",
        color="#f59e0b",
        no_go=True,
        risk=0.85,
        reward=-0.6,
    ),
    "MOT_TRUNK": CellMeta(
        type="MOT_TRUNK",
        name="Motor cortex — trunk",
        description="Eloquent motor territory. Hard no-go in this simulation.",
        color="#f59e0b",
        no_go=True,
        risk=0.85,
        reward=-0.6,
    ),
    "MOT_ARM": CellMeta(
        type="MOT_ARM",
        name="Motor cortex — arm",
        description="Eloquent motor territory. Hard no-go in this simulation.",
        color="#fb923c",
        no_go=True,
        risk=0.9,
        reward=-0.7,
    ),
    "MOT_HAND": CellMeta(
        type="MOT_HAND",
        name="Motor cortex — hand",
        description=(
            "Scenario-relevant hand motor representation. Highlighted context, "
            "and a hard no-go."
        ),
        color="#fbbf24",
        no_go=True,
        risk=0.95,
        reward=-0.8,
    ),
    "MOT_FACE": CellMeta(
        type="MOT_FACE",
        name="Motor cortex — face",
        description="Eloquent motor territory. Hard no-go in this simulation.",
        color="#f59e0b",
        no_go=True,
        risk=0.85,
        reward=-0.6,
    ),
    "SENS": CellMeta(
        type="SENS",
        name="Sensory territory",
        description="Somatosensory tissue posterior to the target. Hard no-go.",
        color="#38bdf8",
        no_go=True,
        risk=0.8,
        reward=-0.5,
    ),
    "THAL": CellMeta(
        type="THAL",
        name="Thalamic tissue",
        description="Generic deep thalamic tissue surrounding the target network.",
        color="#a855f7",
        no_go=False,
        risk=0.35,
        reward=0.2,
    ),
    "VIM_NEAR": CellMeta(
        type="VIM_NEAR",
        name="Near-target network",
        description="Conceptual border zone adjacent to the tremor network.",
        color="#c084fc",
        no_go=False,
        risk=0.3,
        reward=0.45,
    ),
    "VIM_TARGET": CellMeta(
        type="VIM_TARGET",
        name="Tremor-network target",
        description="Conceptual tremor-network goal cell for this scenario.",
        color="#34ff9b",
        no_go=False,
        risk=0.2,
        reward=1,
    ),
    "IC_AVOID": CellMeta(
        type="IC_AVOID",
        name="Internal-capsule analogue",
        description="Dense synthetic fibre bundle. Hard no-go.",
        color="#ff4d6a",
        no_go=True,
        risk=1,
        reward=-1,
    ),
    "VENT_AVOID": CellMeta(
        type="VENT_AVOID",
        name="Ventricle analogue",
        description="Fluid-filled cavity analogue. Hard no-go.",
        color="#f43f5e",
        no_go=True,
        risk=1,
        reward=-1,
    ),
    "BRAINSTEM_AVOID": CellMeta(
        type="BRAINSTEM_AVOID",
        name="Brainstem analogue",
        description="Critical inferior structure analogue. Hard no-go.",
        color="#e11d48",
        no_go=True,
        risk=1,
        reward=-1,
    ),
    "CEREB_NET": CellMeta(
        type="CEREB_NET",
        name="Cerebellar network",
        description="Conceptual cerebellar relay network, modelled but never traversed.",
        color="#fb7185",
        no_go=True,
        risk=0.9,
        reward=-0.8,
    ),
    "OUTSIDE": CellMeta(
        type="OUTSIDE",
        name="Outside modelled volume",
        description=(
            "Beyond the simulated left-hemisphere cutaway. Hard no-go and not rendered."
        ),
        color="#1e293b",
        no_go=True,
        risk=1,
        reward=-1,
    ),
}

LEGEND_ORDER: list[CellType] = [
    "ENT",
    "WM_SAFE",
    "THAL",
    "VIM_NEAR",
    "VIM_TARGET",
    "MOT_HAND",
    "MOT_ARM",
    "MOT_LEG",
    "MOT_TRUNK",
    "MOT_FACE",
    "SENS",
    "IC_AVOID",
    "VENT_AVOID",
    "BRAINSTEM_AVOID",
    "CEREB_NET",
    "OUTSIDE",
]


def is_no_go(cell_type: CellType) -> bool:
    return CELL_META[cell_type].no_go


def meta_to_dict(meta: CellMeta) -> dict:
    return {
        "type": meta.type,
        "name": meta.name,
        "description": meta.description,
        "color": meta.color,
        "noGo": meta.no_go,
        "risk": meta.risk,
        "reward": meta.reward,
    }
