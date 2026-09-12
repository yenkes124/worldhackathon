export type Vec3 = readonly [number, number, number]

export type CellType =
  | 'ENT'
  | 'WM_SAFE'
  | 'MOT_LEG'
  | 'MOT_TRUNK'
  | 'MOT_ARM'
  | 'MOT_HAND'
  | 'MOT_FACE'
  | 'SENS'
  | 'THAL'
  | 'VIM_NEAR'
  | 'VIM_TARGET'
  | 'IC_AVOID'
  | 'VENT_AVOID'
  | 'BRAINSTEM_AVOID'
  | 'CEREB_NET'
  | 'OUTSIDE'

export type ActionId = 'X_POS' | 'X_NEG' | 'Y_POS' | 'Y_NEG' | 'Z_POS' | 'Z_NEG'

export interface Action {
  id: ActionId
  label: string
  hint: string
  delta: Vec3
}

export interface CellMeta {
  type: CellType
  name: string
  description: string
  color: string
  /** Hard constraint for the planner: the probe may never enter this cell. */
  noGo: boolean
  /** Synthetic 0..1 traversal risk used by the world model. */
  risk: number
  /** Synthetic reward signal used by the learner demo. */
  reward: number
}

export interface Cell {
  position: Vec3
  type: CellType
}

export interface Prediction {
  from: Vec3
  action: Action
  to: Vec3
  inBounds: boolean
  predictedType: CellType
  risk: number
  reward: number
  allowed: boolean
  rationale: string
}

export interface PathEvaluation {
  steps: number
  totalRisk: number
  peakRisk: number
  totalReward: number
  reachesTarget: boolean
  violations: { position: Vec3; type: CellType }[]
}

export interface PlanResult {
  path: Vec3[]
  found: boolean
  expanded: number
  evaluation: PathEvaluation
}

export interface LearnerResult extends PlanResult {
  episodes: number
  episodeScores: number[]
}

export interface Scenario {
  id: string
  title: string
  summary: string
  context: string
  target: Vec3
  entries: Vec3[]
  seed: number
}
