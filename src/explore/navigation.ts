import { GRID_SIZE, cellTypeAt } from '../sim/grid'
import type { Vec3 } from '../sim/types'

/**
 * Dead-reckoning of the explorer's position on the symbolic 4×4×4 grid.
 *
 * The generated world (Reactor's LingBot World 2) has no ground-truth camera,
 * so the grid position is integrated from the *actions the model confirms it
 * applied* on each `chunk_complete` event, plus the vertical bias we request
 * through `set_camera_pose`. That keeps the mapping deterministic: the same
 * sequence of confirmed actions always lands on the same cell.
 *
 * Coordinates follow src/sim/grid.ts: x left→right, y anterior→posterior,
 * z inferior→superior. Cell i spans [i − 0.5, i + 0.5) on each axis.
 */
export interface NavState {
  position: Vec3
  /** Yaw in degrees. 0 faces posterior (+y); 90 faces right (+x). */
  heading: number
}

export type Vertical = -1 | 0 | 1

/** Grid cells travelled per completed chunk while a move axis is active. */
export const CELL_PER_CHUNK = 0.1
/** LingBot World 2 default rotation speed (5° per latent frame × 3 frames). */
export const YAW_PER_CHUNK = 15
/** Cells climbed / descended per chunk while a vertical pose is active. */
export const CLIMB_PER_CHUNK = 0.2

const MIN = -0.5 + 1e-6
const MAX = GRID_SIZE - 0.5 - 1e-6
const clamp = (value: number): number => Math.min(MAX, Math.max(MIN, value))

export const cellOf = (position: Vec3): Vec3 => [
  Math.round(position[0]),
  Math.round(position[1]),
  Math.round(position[2]),
]

export const initialNav = (entry: Vec3): NavState => ({
  position: [entry[0], entry[1], entry[2]],
  heading: 0,
})

const toRadians = (deg: number): number => (deg * Math.PI) / 180

/**
 * Integrates one completed chunk. `action` is LingBot's `+`-joined composite
 * (`"w+a"`, `"left"`, `"still"`, …); unknown tokens are ignored.
 */
export const advance = (
  nav: NavState,
  action: string,
  vertical: Vertical = 0,
): NavState => {
  let longitudinal = 0
  let lateral = 0
  let yaw = 0
  for (const token of action.split('+')) {
    switch (token) {
      case 'w':
        longitudinal += 1
        break
      case 's':
        longitudinal -= 1
        break
      case 'a':
        lateral -= 1
        break
      case 'd':
        lateral += 1
        break
      case 'left':
        yaw -= YAW_PER_CHUNK
        break
      case 'right':
        yaw += YAW_PER_CHUNK
        break
      default:
        break
    }
  }

  const heading = ((nav.heading + yaw) % 360 + 360) % 360
  const theta = toRadians(heading)
  const forward: [number, number] = [Math.sin(theta), Math.cos(theta)]
  const right: [number, number] = [Math.cos(theta), -Math.sin(theta)]

  const dx = (forward[0] * longitudinal + right[0] * lateral) * CELL_PER_CHUNK
  const dy = (forward[1] * longitudinal + right[1] * lateral) * CELL_PER_CHUNK
  const dz = vertical * CLIMB_PER_CHUNK

  const candidate: Vec3 = [
    clamp(nav.position[0] + dx),
    clamp(nav.position[1] + dy),
    clamp(nav.position[2] + dz),
  ]

  // Unmodelled cells are walls: stay put rather than leave the cutaway.
  const position =
    cellTypeAt(cellOf(candidate)) === 'OUTSIDE' ? nav.position : candidate

  return { position, heading }
}

/** Compass label for the HUD. */
export const headingLabel = (heading: number): string => {
  const sectors = ['posterior', 'right', 'anterior', 'left']
  return sectors[Math.round(heading / 90) % 4]
}
