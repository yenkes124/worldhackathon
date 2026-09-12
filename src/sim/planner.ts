import { CELL_META } from './cellMeta'
import { cellTypeAt, key, manhattan, sameCell } from './grid'
import { mulberry32 } from './rng'
import type {
  LearnerResult,
  PathEvaluation,
  PlanResult,
  Vec3,
} from './types'
import { legalMoves } from './worldModel'

const RISK_WEIGHT = 2

export const evaluatePath = (path: Vec3[], target: Vec3): PathEvaluation => {
  const visited = path.slice(1)
  const metas = visited.map((position) => CELL_META[cellTypeAt(position)])
  return {
    steps: Math.max(path.length - 1, 0),
    totalRisk: Number(
      metas.reduce((sum, meta) => sum + meta.risk, 0).toFixed(3),
    ),
    peakRisk: metas.reduce((peak, meta) => Math.max(peak, meta.risk), 0),
    totalReward: Number(
      metas.reduce((sum, meta) => sum + meta.reward, 0).toFixed(3),
    ),
    reachesTarget: path.length > 0 && sameCell(path[path.length - 1], target),
    violations: path
      .map((position) => ({ position, type: cellTypeAt(position) }))
      .filter((cell) => CELL_META[cell.type].noGo),
  }
}

const emptyResult = (target: Vec3): PlanResult => ({
  path: [],
  found: false,
  expanded: 0,
  evaluation: evaluatePath([], target),
})

/**
 * Risk-weighted A*. No-go cells are filtered out by the world model before they
 * ever enter the frontier, so they act as hard constraints rather than penalties.
 */
export const planAStar = (start: Vec3, target: Vec3): PlanResult => {
  if (CELL_META[cellTypeAt(start)].noGo) return emptyResult(target)

  const startKey = key(start)
  const cameFrom = new Map<string, Vec3>()
  const gScore = new Map<string, number>([[startKey, 0]])
  const positions = new Map<string, Vec3>([[startKey, start]])
  const open = new Set<string>([startKey])
  let expanded = 0

  while (open.size > 0) {
    let currentKey = ''
    let bestScore = Infinity
    for (const candidate of open) {
      const score =
        (gScore.get(candidate) ?? Infinity) +
        manhattan(positions.get(candidate) as Vec3, target)
      if (score < bestScore) {
        bestScore = score
        currentKey = candidate
      }
    }

    const current = positions.get(currentKey) as Vec3
    if (sameCell(current, target)) {
      const path: Vec3[] = [current]
      let cursor = currentKey
      while (cameFrom.has(cursor)) {
        const previous = cameFrom.get(cursor) as Vec3
        path.unshift(previous)
        cursor = key(previous)
      }
      return { path, found: true, expanded, evaluation: evaluatePath(path, target) }
    }

    open.delete(currentKey)
    expanded += 1

    for (const move of legalMoves(current)) {
      const neighbourKey = key(move.to)
      const tentative =
        (gScore.get(currentKey) ?? Infinity) + 1 + move.risk * RISK_WEIGHT
      if (tentative < (gScore.get(neighbourKey) ?? Infinity)) {
        cameFrom.set(neighbourKey, current)
        gScore.set(neighbourKey, tentative)
        positions.set(neighbourKey, move.to)
        open.add(neighbourKey)
      }
    }
  }

  return emptyResult(target)
}

/**
 * The "shortest looking" route a naive planner would draw: move along x, then y,
 * then z, ignoring tissue constraints entirely. Used to visualise failure.
 */
export const naiveUnsafePath = (start: Vec3, target: Vec3): Vec3[] => {
  const path: Vec3[] = [start]
  const cursor: [number, number, number] = [start[0], start[1], start[2]]
  for (const axis of [0, 1, 2] as const) {
    while (cursor[axis] !== target[axis]) {
      cursor[axis] += cursor[axis] < target[axis] ? 1 : -1
      path.push([cursor[0], cursor[1], cursor[2]])
    }
  }
  return path
}

export const explainFailure = (path: Vec3[], target: Vec3): string => {
  const { violations, reachesTarget } = evaluatePath(path, target)
  if (violations.length === 0) {
    return reachesTarget
      ? 'This candidate happens to stay inside permitted tissue.'
      : 'This candidate never reaches the target cell.'
  }
  const first = violations[0]
  const meta = CELL_META[first.type]
  const extra =
    violations.length > 1
      ? ` and ${violations.length - 1} further no-go cell${violations.length > 2 ? 's' : ''}`
      : ''
  return `Rejected at [${first.position.join(', ')}]: ${meta.name}${extra}. ${meta.description}`
}

/**
 * Learner demo: seeded risk-averse rollouts that only use the world model's
 * one-step predictions. Deterministic for a given seed, and it keeps the best
 * safe trajectory it discovers.
 */
export const runLearner = (
  start: Vec3,
  target: Vec3,
  seed: number,
  episodes = 240,
): LearnerResult => {
  const random = mulberry32(seed)
  const maxSteps = 24
  let best: Vec3[] = []
  let bestScore = -Infinity
  const episodeScores: number[] = []

  for (let episode = 0; episode < episodes; episode += 1) {
    const explore = Math.max(0.05, 0.65 * (1 - episode / episodes))
    const path: Vec3[] = [start]
    const seen = new Set<string>([key(start)])
    let cursor = start
    let score = 0

    for (let step = 0; step < maxSteps; step += 1) {
      if (sameCell(cursor, target)) break
      const options = legalMoves(cursor).filter(
        (move) => !seen.has(key(move.to)),
      )
      if (options.length === 0) break

      const scored = options.map((move) => ({
        move,
        value:
          move.reward * 2 - move.risk - manhattan(move.to, target) * 0.5,
      }))
      scored.sort((a, b) => b.value - a.value)

      const chosen =
        random() < explore
          ? scored[Math.floor(random() * scored.length)]
          : scored[0]

      cursor = chosen.move.to
      seen.add(key(cursor))
      path.push(cursor)
      score += chosen.move.reward - chosen.move.risk * 0.5
    }

    const reached = sameCell(cursor, target)
    const episodeScore = reached ? score + 5 - path.length * 0.1 : score - 5
    episodeScores.push(Number(episodeScore.toFixed(3)))

    if (reached && episodeScore > bestScore) {
      bestScore = episodeScore
      best = path
    }
  }

  return {
    path: best,
    found: best.length > 0,
    expanded: episodes,
    episodes,
    episodeScores,
    evaluation: evaluatePath(best, target),
  }
}
