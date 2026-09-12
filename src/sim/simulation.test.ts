import { describe, expect, it } from 'vitest'
import { CELL_META } from './cellMeta'
import { GRID_SIZE, buildGrid, cellTypeAt, inBounds, sameCell } from './grid'
import {
  evaluatePath,
  explainFailure,
  naiveUnsafePath,
  planAStar,
  runLearner,
} from './planner'
import { RIGHT_HAND_TREMOR, VIM_TARGET_POSITION } from './scenario'
import type { Vec3 } from './types'
import { ACTIONS, actionById, predictTransition } from './worldModel'

describe('grid bounds', () => {
  it('accepts every in-volume coordinate', () => {
    const cells = buildGrid()
    expect(cells).toHaveLength(GRID_SIZE ** 3)
    expect(cells.every((cell) => inBounds(cell.position))).toBe(true)
  })

  it('rejects coordinates outside the volume', () => {
    const outside: Vec3[] = [
      [-1, 0, 0],
      [0, -1, 0],
      [0, 0, -1],
      [4, 0, 0],
      [0, 4, 0],
      [0, 0, 4],
      [1.5, 1, 1],
    ]
    for (const position of outside) {
      expect(inBounds(position)).toBe(false)
      expect(cellTypeAt(position)).toBe('OUTSIDE')
    }
  })
})

describe('transition prediction', () => {
  it('is deterministic and additive', () => {
    const from: Vec3 = [1, 1, 2]
    const first = predictTransition(from, actionById('Z_NEG'))
    const second = predictTransition(from, actionById('Z_NEG'))
    expect(first.to).toEqual([1, 1, 1])
    expect(first).toEqual(second)
    expect(first.predictedType).toBe('VIM_TARGET')
    expect(first.allowed).toBe(true)
  })

  it('predicts OUTSIDE instead of wrapping at the boundary', () => {
    const prediction = predictTransition([0, 0, 3], actionById('Z_POS'))
    expect(prediction.inBounds).toBe(false)
    expect(prediction.predictedType).toBe('OUTSIDE')
    expect(prediction.allowed).toBe(false)
  })

  it('reports risk and reward for every action from a cell', () => {
    for (const action of ACTIONS) {
      const prediction = predictTransition([1, 1, 2], action)
      expect(prediction.risk).toBe(CELL_META[prediction.predictedType].risk)
      expect(prediction.reward).toBe(CELL_META[prediction.predictedType].reward)
    }
  })
})

describe('no-go constraints', () => {
  const noGoTypes = [
    'IC_AVOID',
    'VENT_AVOID',
    'BRAINSTEM_AVOID',
    'CEREB_NET',
    'OUTSIDE',
    'SENS',
    'MOT_LEG',
    'MOT_TRUNK',
    'MOT_ARM',
    'MOT_HAND',
    'MOT_FACE',
  ] as const

  it('marks every forbidden tissue class as a hard constraint', () => {
    for (const type of noGoTypes) {
      expect(CELL_META[type].noGo).toBe(true)
    }
  })

  it('never routes a plan through a no-go cell', () => {
    for (const entry of RIGHT_HAND_TREMOR.entries) {
      const plan = planAStar(entry, VIM_TARGET_POSITION)
      expect(plan.found).toBe(true)
      expect(plan.evaluation.violations).toHaveLength(0)
    }
  })

  it('refuses to plan from a forbidden start cell', () => {
    const plan = planAStar([1, 1, 3], VIM_TARGET_POSITION)
    expect(plan.found).toBe(false)
    expect(plan.path).toHaveLength(0)
  })
})

describe('target reachability', () => {
  it('reaches the target from every entry point with contiguous steps', () => {
    expect(RIGHT_HAND_TREMOR.entries.length).toBeGreaterThan(0)
    for (const entry of RIGHT_HAND_TREMOR.entries) {
      const { path, evaluation } = planAStar(entry, VIM_TARGET_POSITION)
      expect(sameCell(path[0], entry)).toBe(true)
      expect(evaluation.reachesTarget).toBe(true)
      for (let i = 1; i < path.length; i += 1) {
        const delta =
          Math.abs(path[i][0] - path[i - 1][0]) +
          Math.abs(path[i][1] - path[i - 1][1]) +
          Math.abs(path[i][2] - path[i - 1][2])
        expect(delta).toBe(1)
      }
    }
  })

  it('is deterministic across repeated runs', () => {
    const entry = RIGHT_HAND_TREMOR.entries[0]
    expect(planAStar(entry, VIM_TARGET_POSITION).path).toEqual(
      planAStar(entry, VIM_TARGET_POSITION).path,
    )
  })
})

describe('failed candidate route', () => {
  it('crosses the hand motor cortex and is explained', () => {
    const entry = RIGHT_HAND_TREMOR.entries[0]
    const path = naiveUnsafePath(entry, VIM_TARGET_POSITION)
    const evaluation = evaluatePath(path, VIM_TARGET_POSITION)
    expect(evaluation.reachesTarget).toBe(true)
    expect(evaluation.violations.length).toBeGreaterThan(0)
    expect(explainFailure(path, VIM_TARGET_POSITION)).toMatch(/Rejected at/)
  })
})

describe('learner demo', () => {
  it('finds a safe trajectory and is reproducible from the seed', () => {
    const entry = RIGHT_HAND_TREMOR.entries[0]
    const first = runLearner(entry, VIM_TARGET_POSITION, RIGHT_HAND_TREMOR.seed)
    const second = runLearner(entry, VIM_TARGET_POSITION, RIGHT_HAND_TREMOR.seed)
    expect(first.found).toBe(true)
    expect(first.evaluation.violations).toHaveLength(0)
    expect(first.evaluation.reachesTarget).toBe(true)
    expect(second.path).toEqual(first.path)
  })
})
