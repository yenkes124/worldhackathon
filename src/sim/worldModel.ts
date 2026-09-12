import { CELL_META } from './cellMeta'
import { cellTypeAt, inBounds } from './grid'
import type { Action, ActionId, Prediction, Vec3 } from './types'

export const ACTIONS: Action[] = [
  { id: 'X_NEG', label: 'Move left', hint: 'x − 1', delta: [-1, 0, 0] },
  { id: 'X_POS', label: 'Move right', hint: 'x + 1', delta: [1, 0, 0] },
  { id: 'Y_NEG', label: 'Move anterior', hint: 'y − 1', delta: [0, -1, 0] },
  { id: 'Y_POS', label: 'Move posterior', hint: 'y + 1', delta: [0, 1, 0] },
  { id: 'Z_NEG', label: 'Move inferior', hint: 'z − 1', delta: [0, 0, -1] },
  { id: 'Z_POS', label: 'Move superior', hint: 'z + 1', delta: [0, 0, 1] },
]

export const actionById = (id: ActionId): Action => {
  const action = ACTIONS.find((candidate) => candidate.id === id)
  if (!action) throw new Error(`Unknown action: ${id}`)
  return action
}

export const actionForStep = (from: Vec3, to: Vec3): Action | undefined =>
  ACTIONS.find(
    (action) =>
      from[0] + action.delta[0] === to[0] &&
      from[1] + action.delta[1] === to[1] &&
      from[2] + action.delta[2] === to[2],
  )

/**
 * Deterministic world model: one action in, one predicted next state out.
 * Out-of-bounds transitions resolve to OUTSIDE rather than wrapping or clamping.
 */
export const predictTransition = (from: Vec3, action: Action): Prediction => {
  const to: Vec3 = [
    from[0] + action.delta[0],
    from[1] + action.delta[1],
    from[2] + action.delta[2],
  ]
  const withinGrid = inBounds(to)
  const predictedType = cellTypeAt(to)
  const meta = CELL_META[predictedType]
  const allowed = withinGrid && !meta.noGo

  const rationale = !withinGrid
    ? 'Leaves the modelled 4×4×4 volume.'
    : meta.noGo
      ? `Blocked: ${meta.name} is a hard no-go constraint.`
      : `Permitted: ${meta.name}.`

  return {
    from,
    action,
    to,
    inBounds: withinGrid,
    predictedType,
    risk: meta.risk,
    reward: meta.reward,
    allowed,
    rationale,
  }
}

export const legalMoves = (from: Vec3): Prediction[] =>
  ACTIONS.map((action) => predictTransition(from, action)).filter(
    (prediction) => prediction.allowed,
  )
