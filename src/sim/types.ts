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

/** Explore and Learn: what the agent believes about a cell, never ground truth. */
export type KnowledgeStatus =
  | 'UNKNOWN'
  | 'PREDICTED_SAFE'
  | 'PREDICTED_RISK'
  | 'CONFIRMED_SAFE'
  | 'CONFIRMED_NO_GO'
  | 'KNOWN_ENTRY'
  | 'KNOWN_TARGET'

export type RiskBand = 'low' | 'medium' | 'high' | 'unknown'

export interface KnowledgeCell {
  position: Vec3
  status: KnowledgeStatus
  predictedLabel?: CellType | null
  predictedRisk: RiskBand
  /** 0-100 belief strength. 100 only after a simulated safety check. */
  confidence: number
  /** Populated only once the cell has actually been observed. */
  observedLabel?: CellType | null
  observationCount: number
  lastUpdatedAtStep: number
}

export type KnowledgeMap = Record<string, KnowledgeCell>

export interface ExplorePrediction {
  from: Vec3
  action: Action
  predictedPosition: Vec3
  inBounds: boolean
  predictedStatus: KnowledgeStatus
  predictedLabel: CellType | null
  predictedRisk: RiskBand
  confidence: number
  traversableAccordingToKnowledge: boolean
  explanation: string
}

export type ExploreOutcome = 'safe' | 'target' | 'restricted' | 'out_of_bounds'

export interface KnowledgeUpdate {
  position: Vec3
  status: KnowledgeStatus
  observedLabel: CellType | null
  confidence: number
}

export interface ExploreObservation {
  from: Vec3
  action: Action
  proposedPosition: Vec3
  allowedToAdvance: boolean
  outcome: ExploreOutcome
  /** Where the probe actually ends up: unchanged when the move is rejected. */
  actualPosition: Vec3
  actualLabel: CellType | null
  actualRisk: RiskBand
  predictionMatched: boolean
  knowledgeUpdate: KnowledgeUpdate | null
  explanation: string
  step: number
}

export interface ExploreRouteResult {
  found: boolean
  from: Vec3
  target: Vec3
  route: Vec3[]
  totalCost: number
  expanded: number
  unknownCells: number
  explanation: string
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
