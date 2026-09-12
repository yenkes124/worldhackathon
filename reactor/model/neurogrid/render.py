"""Software renderer for the brain-grid scene.

Reactor streams RGB frames rather than hosting a WebGL scene, so the 3D view
is rasterised here with Pillow: an orbitable orthographic camera, painter's-
algorithm voxel cubes, planned/unsafe trajectories and the probe. Colours and
opacities mirror ``src/components/scene/VoxelGrid.tsx`` and the procedural
"brain shell" is a translucent seeded blob, exactly as invented as the original.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .cell_meta import CELL_META
from .grid import build_grid, cell_type_at, describe_coord, key, same_cell, to_scene_position
from .rng import mulberry32
from .types import Vec3

BACKGROUND = (5, 7, 15)
SHELL_COLOR = (56, 189, 248)
PLANNED_COLOR = (52, 255, 155)
FAILED_COLOR = (255, 77, 106)
PROBE_COLOR = (255, 255, 255)


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16)


@dataclass
class Camera:
    yaw: float = 0.62
    pitch: float = 0.48
    zoom: float = 1.0

    def clamp(self) -> None:
        self.pitch = max(-1.35, min(1.35, self.pitch))
        self.zoom = max(0.5, min(2.2, self.zoom))
        self.yaw = math.atan2(math.sin(self.yaw), math.cos(self.yaw))


@dataclass(frozen=True)
class SceneState:
    entry: Vec3
    target: Vec3
    highlight: tuple[Vec3, ...]
    planned_path: tuple[Vec3, ...]
    failed_path: tuple[Vec3, ...]
    show_failed: bool
    probe: Vec3
    step_index: int
    hovered: Vec3 | None = None


def _load_font(size: int) -> ImageFont.ImageFont | ImageFont.FreeTypeFont:
    for candidate in (
        "DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


class SceneRenderer:
    def __init__(self, width: int = 960, height: int = 600, seed: int = 20240917) -> None:
        self.width = width
        self.height = height
        self.font = _load_font(13)
        self.small_font = _load_font(11)
        self.cells = [cell for cell in build_grid() if cell.type != "OUTSIDE"]
        self.shell = self._build_shell(seed)
        self.backdrop = self._build_backdrop()

    # -- projection ------------------------------------------------------------------

    def _rotate(self, point: tuple[float, float, float], camera: Camera) -> tuple[float, float, float]:
        x, y, z = point
        cy, sy = math.cos(camera.yaw), math.sin(camera.yaw)
        x, z = x * cy + z * sy, -x * sy + z * cy
        cp, sp = math.cos(camera.pitch), math.sin(camera.pitch)
        y, z = y * cp - z * sp, y * sp + z * cp
        return x, y, z

    def _project(self, point: tuple[float, float, float], camera: Camera) -> tuple[float, float, float]:
        """Orthographic projection to pixel space; the third value is depth."""
        x, y, z = self._rotate(point, camera)
        scale = min(self.width, self.height) * 0.17 * camera.zoom
        px = self.width * 0.5 + x * scale
        py = self.height * 0.52 - y * scale
        return px, py, z

    # -- static layers ------------------------------------------------------------------

    def _build_shell(self, seed: int) -> list[tuple[float, float, float]]:
        random = mulberry32(seed)
        points = []
        for _ in range(420):
            u = random() * 2 - 1
            theta = random() * math.tau
            r = math.sqrt(max(0.0, 1 - u * u))
            wobble = 1 + (random() - 0.5) * 0.22
            points.append(
                (r * math.cos(theta) * 2.55 * wobble, u * 2.1 * wobble, r * math.sin(theta) * 2.35 * wobble)
            )
        return points

    def _build_backdrop(self) -> Image.Image:
        image = Image.new("RGB", (self.width, self.height), BACKGROUND)
        glow = Image.new("RGB", (self.width, self.height), BACKGROUND)
        draw = ImageDraw.Draw(glow)
        cx, cy = self.width * 0.5, self.height * 0.52
        rx, ry = self.width * 0.32, self.height * 0.42
        draw.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(14, 22, 48))
        glow = glow.filter(ImageFilter.GaussianBlur(70))
        return Image.blend(image, glow, 0.9)

    # -- frame ------------------------------------------------------------------

    def render(self, state: SceneState, camera: Camera) -> np.ndarray:
        frame = self.backdrop.copy()
        overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay, "RGBA")

        self._draw_shell(draw, camera)
        self._draw_axes(draw, camera)

        path_keys = {key(p) for p in state.planned_path}
        cubes = sorted(
            ((self._project(to_scene_position(cell.position), camera)[2], cell) for cell in self.cells),
            key=lambda item: item[0],
        )
        for _, cell in cubes:
            self._draw_cube(draw, cell.position, cell.type, state, camera, key(cell.position) in path_keys)

        if state.show_failed and len(state.failed_path) > 1:
            self._draw_path(draw, state.failed_path, camera, FAILED_COLOR, dashed=True)
        if len(state.planned_path) > 1:
            self._draw_path(draw, state.planned_path, camera, PLANNED_COLOR)
            self._draw_path(draw, state.planned_path[: state.step_index + 1], camera, (255, 255, 255), width=3)

        self._draw_probe(draw, state.probe, camera)
        self._draw_labels(draw, state, camera)

        frame = Image.alpha_composite(frame.convert("RGBA"), overlay).convert("RGB")
        return np.asarray(frame, dtype=np.uint8)

    def _draw_shell(self, draw: ImageDraw.ImageDraw, camera: Camera) -> None:
        projected = [self._project(p, camera) for p in self.shell]
        for px, py, depth in projected:
            alpha = int(28 + 40 * (depth + 2.6) / 5.2)
            draw.ellipse((px - 1.6, py - 1.6, px + 1.6, py + 1.6), fill=(*SHELL_COLOR, max(10, min(90, alpha))))

    def _draw_axes(self, draw: ImageDraw.ImageDraw, camera: Camera) -> None:
        origin = (-2.9, -2.2, -2.9)
        axes = [
            ((1.0, 0.0, 0.0), "x → right", (148, 163, 184)),
            ((0.0, 1.0, 0.0), "z → superior", (148, 163, 184)),
            ((0.0, 0.0, 1.0), "y → posterior", (148, 163, 184)),
        ]
        o = self._project(origin, camera)
        for direction, label, colour in axes:
            end = tuple(origin[i] + direction[i] * 0.9 for i in range(3))
            e = self._project(end, camera)
            draw.line((o[0], o[1], e[0], e[1]), fill=(*colour, 120), width=1)
            draw.text((e[0] + 3, e[1] - 6), label, fill=(*colour, 170), font=self.small_font)

    def _cube_alpha(self, cell_type: str, on_path: bool, highlighted: bool, hovered: bool) -> float:
        if hovered:
            return 0.8
        if cell_type == "VIM_TARGET":
            return 0.95
        if cell_type == "ENT":
            return 0.55
        if on_path or highlighted:
            return 0.5
        if CELL_META[cell_type].no_go:
            return 0.26
        return 0.14

    def _draw_cube(
        self,
        draw: ImageDraw.ImageDraw,
        position: Vec3,
        cell_type: str,
        state: SceneState,
        camera: Camera,
        on_path: bool,
    ) -> None:
        meta = CELL_META[cell_type]
        colour = hex_to_rgb(meta.color)
        is_target = same_cell(position, state.target)
        is_entry = same_cell(position, state.entry)
        hovered = state.hovered is not None and same_cell(position, state.hovered)
        highlighted = any(same_cell(position, h) for h in state.highlight)
        half = (0.58 if is_target else 0.5) / 2
        cx, cy, cz = to_scene_position(position)

        corners = [
            (cx + sx * half, cy + sy * half, cz + sz * half)
            for sx in (-1, 1)
            for sy in (-1, 1)
            for sz in (-1, 1)
        ]
        projected = [self._project(c, camera) for c in corners]
        # corner index bits: x -> 4, y -> 2, z -> 1
        faces = [
            ((0, 1, 3, 2), (-1, 0, 0)),
            ((4, 5, 7, 6), (1, 0, 0)),
            ((0, 1, 5, 4), (0, -1, 0)),
            ((2, 3, 7, 6), (0, 1, 0)),
            ((0, 2, 6, 4), (0, 0, -1)),
            ((1, 3, 7, 5), (0, 0, 1)),
        ]
        base_alpha = self._cube_alpha(cell_type, on_path, highlighted, hovered)
        emissive = 1.4 if is_target else (0.7 if hovered or on_path else 0.25)
        visible = []
        for indices, normal in faces:
            _, _, depth = self._rotate(normal, camera)
            if depth <= 0:
                continue
            visible.append((depth, indices))
        visible.sort(key=lambda item: item[0])
        for facing, indices in visible:
            shade = 0.55 + 0.45 * facing
            lit = tuple(min(255, int(c * shade * (0.75 + 0.35 * emissive))) for c in colour)
            alpha = int(255 * min(1.0, base_alpha * (0.6 + 0.4 * facing)))
            polygon = [(projected[i][0], projected[i][1]) for i in indices]
            draw.polygon(polygon, fill=(*lit, alpha))
        edge_alpha = int(255 * (0.55 if on_path or is_target or is_entry else 0.18))
        edges = [
            (0, 1), (1, 3), (3, 2), (2, 0),
            (4, 5), (5, 7), (7, 6), (6, 4),
            (0, 4), (1, 5), (2, 6), (3, 7),
        ]
        for a, b in edges:
            draw.line(
                (projected[a][0], projected[a][1], projected[b][0], projected[b][1]),
                fill=(*colour, edge_alpha),
                width=1,
            )

    def _draw_path(
        self,
        draw: ImageDraw.ImageDraw,
        path: tuple[Vec3, ...],
        camera: Camera,
        colour: tuple[int, int, int],
        dashed: bool = False,
        width: int = 4,
    ) -> None:
        points = [self._project(to_scene_position(p), camera) for p in path]
        for (x0, y0, _), (x1, y1, _) in zip(points, points[1:]):
            if not dashed:
                draw.line((x0, y0, x1, y1), fill=(*colour, 230), width=width)
                continue
            segments = 6
            for i in range(0, segments, 2):
                t0, t1 = i / segments, (i + 1) / segments
                draw.line(
                    (x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1),
                    fill=(*colour, 220),
                    width=width,
                )
        for px, py, _ in points:
            draw.ellipse((px - 3, py - 3, px + 3, py + 3), fill=(*colour, 200))

    def _draw_probe(self, draw: ImageDraw.ImageDraw, probe: Vec3, camera: Camera) -> None:
        px, py, _ = self._project(to_scene_position(probe), camera)
        for radius, alpha in ((16, 40), (11, 90), (7, 255)):
            draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill=(*PROBE_COLOR, alpha))

    def _label(self, draw: ImageDraw.ImageDraw, x: float, y: float, text: str, colour: tuple[int, int, int]) -> None:
        bbox = draw.textbbox((0, 0), text, font=self.small_font)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        box = (x - w / 2 - 6, y - h - 6, x + w / 2 + 6, y + 4)
        draw.rounded_rectangle(box, radius=8, fill=(5, 7, 15, 200), outline=(*colour, 255))
        draw.text((x - w / 2, y - h - 1), text, fill=(*colour, 255), font=self.small_font)

    def _draw_labels(self, draw: ImageDraw.ImageDraw, state: SceneState, camera: Camera) -> None:
        for position, tag in ((state.target, "VIM_TARGET"), (state.entry, "ENTRY")):
            px, py, _ = self._project(to_scene_position(position), camera)
            colour = hex_to_rgb(CELL_META["VIM_TARGET" if tag == "VIM_TARGET" else "ENT"].color)
            self._label(draw, px, py - 34, f"{tag} [{','.join(map(str, position))}]", colour)
        if state.hovered is not None:
            cell_type = cell_type_at(state.hovered)
            px, py, _ = self._project(to_scene_position(state.hovered), camera)
            self._label(
                draw,
                px,
                py - 56,
                f"{cell_type} [{', '.join(map(str, state.hovered))}] · {describe_coord(state.hovered)}",
                hex_to_rgb(CELL_META[cell_type].color),
            )
        draw.text(
            (16, self.height - 24),
            "Synthetic geometry · invented coordinates · not medical software",
            fill=(100, 116, 139, 255),
            font=self.small_font,
        )

    # -- picking ------------------------------------------------------------------

    def pick(self, u: float, v: float, camera: Camera) -> Vec3 | None:
        """Return the front-most voxel under normalised viewport coords ``(u, v)`` in [0, 1]."""
        px, py = u * self.width, v * self.height
        best: tuple[float, Vec3] | None = None
        for cell in self.cells:
            cx, cy, depth = self._project(to_scene_position(cell.position), camera)
            radius = min(self.width, self.height) * 0.17 * camera.zoom * 0.28
            if (px - cx) ** 2 + (py - cy) ** 2 <= radius**2 and (best is None or depth > best[0]):
                best = (depth, cell.position)
        return best[1] if best else None
