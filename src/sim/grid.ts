import type { Cell, CellType, Vec3 } from './types'

export const GRID_SIZE = 4

/**
 * Synthetic left-hemisphere cutaway volume.
 *
 * Coordinate convention:
 *   x: 0 = left (lateral)     -> 3 = right
 *   y: 0 = anterior           -> 3 = posterior
 *   z: 0 = inferior           -> 3 = superior
 *
 * Layers are written superior-first for readability; each layer lists rows by
 * y (anterior first) and columns by x (left first). Columns x = 2 host midline
 * structures and x = 3 falls outside the modelled hemisphere.
 */
const LAYERS: Record<number, CellType[][]> = {
  3: [
    ['ENT', 'ENT', 'OUTSIDE', 'OUTSIDE'],
    ['ENT', 'MOT_HAND', 'OUTSIDE', 'OUTSIDE'],
    ['MOT_FACE', 'MOT_ARM', 'OUTSIDE', 'OUTSIDE'],
    ['MOT_TRUNK', 'MOT_LEG', 'OUTSIDE', 'OUTSIDE'],
  ],
  2: [
    ['WM_SAFE', 'WM_SAFE', 'OUTSIDE', 'OUTSIDE'],
    ['WM_SAFE', 'WM_SAFE', 'IC_AVOID', 'OUTSIDE'],
    ['WM_SAFE', 'WM_SAFE', 'VENT_AVOID', 'OUTSIDE'],
    ['SENS', 'SENS', 'VENT_AVOID', 'OUTSIDE'],
  ],
  1: [
    ['IC_AVOID', 'WM_SAFE', 'VENT_AVOID', 'OUTSIDE'],
    ['VIM_NEAR', 'VIM_TARGET', 'THAL', 'OUTSIDE'],
    ['THAL', 'VIM_NEAR', 'THAL', 'OUTSIDE'],
    ['SENS', 'THAL', 'VENT_AVOID', 'OUTSIDE'],
  ],
  0: [
    ['WM_SAFE', 'BRAINSTEM_AVOID', 'BRAINSTEM_AVOID', 'OUTSIDE'],
    ['IC_AVOID', 'BRAINSTEM_AVOID', 'BRAINSTEM_AVOID', 'OUTSIDE'],
    ['CEREB_NET', 'CEREB_NET', 'CEREB_NET', 'OUTSIDE'],
    ['CEREB_NET', 'CEREB_NET', 'CEREB_NET', 'OUTSIDE'],
  ],
}

export const inBounds = ([x, y, z]: Vec3): boolean =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  Number.isInteger(z) &&
  x >= 0 &&
  x < GRID_SIZE &&
  y >= 0 &&
  y < GRID_SIZE &&
  z >= 0 &&
  z < GRID_SIZE

export const key = ([x, y, z]: Vec3): string => `${x},${y},${z}`

export const fromKey = (value: string): Vec3 => {
  const [x, y, z] = value.split(',').map(Number)
  return [x, y, z]
}

export const sameCell = (a: Vec3, b: Vec3): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

export const cellTypeAt = (position: Vec3): CellType => {
  if (!inBounds(position)) return 'OUTSIDE'
  const [x, y, z] = position
  return LAYERS[z][y][x]
}

export const buildGrid = (): Cell[] => {
  const cells: Cell[] = []
  for (let z = 0; z < GRID_SIZE; z += 1) {
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const position: Vec3 = [x, y, z]
        cells.push({ position, type: cellTypeAt(position) })
      }
    }
  }
  return cells
}

export const cellsOfType = (type: CellType): Vec3[] =>
  buildGrid()
    .filter((cell) => cell.type === type)
    .map((cell) => cell.position)

export const manhattan = (a: Vec3, b: Vec3): number =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])

/** Voxel centre in scene space: grid y maps to depth, grid z maps to height. */
export const toScenePosition = (
  [x, y, z]: Vec3,
  spacing = 1,
): [number, number, number] => [
  (x - (GRID_SIZE - 1) / 2) * spacing,
  (z - (GRID_SIZE - 1) / 2) * spacing,
  (y - (GRID_SIZE - 1) / 2) * spacing,
]

export const describeCoord = ([x, y, z]: Vec3): string => {
  const lateral = x <= 1 ? 'left' : 'right'
  const depth = y <= 1 ? 'anterior' : 'posterior'
  const height = z <= 1 ? 'inferior' : 'superior'
  return `${lateral} · ${depth} · ${height}`
}
