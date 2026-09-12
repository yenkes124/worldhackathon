"""The 4x4x4 labelled voxel volume. Mirrors ``src/sim/grid.ts``.

Coordinate convention (identical to the TypeScript original):
    x: 0 = left (lateral)  -> 3 = right
    y: 0 = anterior        -> 3 = posterior
    z: 0 = inferior        -> 3 = superior

Layers are written superior-first for readability; each layer lists rows by y
(anterior first) and columns by x (left first). Column x = 2 hosts midline
structures and x = 3 falls outside the modelled hemisphere.
"""

from __future__ import annotations

from .types import Cell, CellType, Vec3

GRID_SIZE = 4

_LAYERS: dict[int, list[list[CellType]]] = {
    3: [
        ["ENT", "ENT", "OUTSIDE", "OUTSIDE"],
        ["ENT", "MOT_HAND", "OUTSIDE", "OUTSIDE"],
        ["MOT_FACE", "MOT_ARM", "OUTSIDE", "OUTSIDE"],
        ["MOT_TRUNK", "MOT_LEG", "OUTSIDE", "OUTSIDE"],
    ],
    2: [
        ["WM_SAFE", "WM_SAFE", "OUTSIDE", "OUTSIDE"],
        ["WM_SAFE", "WM_SAFE", "IC_AVOID", "OUTSIDE"],
        ["WM_SAFE", "WM_SAFE", "VENT_AVOID", "OUTSIDE"],
        ["SENS", "SENS", "VENT_AVOID", "OUTSIDE"],
    ],
    1: [
        ["IC_AVOID", "WM_SAFE", "VENT_AVOID", "OUTSIDE"],
        ["VIM_NEAR", "VIM_TARGET", "THAL", "OUTSIDE"],
        ["THAL", "VIM_NEAR", "THAL", "OUTSIDE"],
        ["SENS", "THAL", "VENT_AVOID", "OUTSIDE"],
    ],
    0: [
        ["WM_SAFE", "BRAINSTEM_AVOID", "BRAINSTEM_AVOID", "OUTSIDE"],
        ["IC_AVOID", "BRAINSTEM_AVOID", "BRAINSTEM_AVOID", "OUTSIDE"],
        ["CEREB_NET", "CEREB_NET", "CEREB_NET", "OUTSIDE"],
        ["CEREB_NET", "CEREB_NET", "CEREB_NET", "OUTSIDE"],
    ],
}


def _is_int(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) or (
        isinstance(value, float) and value.is_integer()
    )


def in_bounds(position: tuple[float, float, float]) -> bool:
    x, y, z = position
    return (
        _is_int(x)
        and _is_int(y)
        and _is_int(z)
        and 0 <= x < GRID_SIZE
        and 0 <= y < GRID_SIZE
        and 0 <= z < GRID_SIZE
    )


def key(position: Vec3) -> str:
    x, y, z = position
    return f"{x},{y},{z}"


def from_key(value: str) -> Vec3:
    x, y, z = (int(part) for part in value.split(","))
    return (x, y, z)


def same_cell(a: Vec3, b: Vec3) -> bool:
    return a[0] == b[0] and a[1] == b[1] and a[2] == b[2]


def cell_type_at(position: tuple[float, float, float]) -> CellType:
    if not in_bounds(position):
        return "OUTSIDE"
    x, y, z = (int(v) for v in position)
    return _LAYERS[z][y][x]


def build_grid() -> list[Cell]:
    cells: list[Cell] = []
    for z in range(GRID_SIZE):
        for y in range(GRID_SIZE):
            for x in range(GRID_SIZE):
                position: Vec3 = (x, y, z)
                cells.append(Cell(position=position, type=cell_type_at(position)))
    return cells


def cells_of_type(cell_type: CellType) -> tuple[Vec3, ...]:
    return tuple(cell.position for cell in build_grid() if cell.type == cell_type)


def manhattan(a: Vec3, b: Vec3) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def to_scene_position(position: Vec3, spacing: float = 1.0) -> tuple[float, float, float]:
    """Voxel centre in scene space: grid y maps to depth, grid z maps to height."""
    x, y, z = position
    half = (GRID_SIZE - 1) / 2
    return ((x - half) * spacing, (z - half) * spacing, (y - half) * spacing)


def describe_coord(position: Vec3) -> str:
    x, y, z = position
    lateral = "left" if x <= 1 else "right"
    depth = "anterior" if y <= 1 else "posterior"
    height = "inferior" if z <= 1 else "superior"
    return f"{lateral} · {depth} · {height}"
