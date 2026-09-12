// Wire types for the messages the NeuroGrid Reactor model sends
// (see reactor/model/model.py and neurogrid/session.py).

export type Vec3 = [number, number, number]
export type PlanningMode = 'astar' | 'learner'

export interface CellMetaWire {
  type: string
  name: string
  description: string
  color: string
  noGo: boolean
  risk: number
  reward: number
}

export interface ScenarioWire {
  id: string
  title: string
  summary: string
  context: string
  target: Vec3
  entries: Vec3[]
  seed: number
}

export interface ScenarioInfo {
  scenario: ScenarioWire
  highlight_context: Vec3[]
  legend: CellMetaWire[]
  grid: { position: Vec3; type: string }[]
  step_interval_ms: number
  safety_notice: string
}

export interface PredictionWire {
  from: Vec3
  action: { id: string; label: string; hint: string; delta: Vec3 }
  to: Vec3
  in_bounds: boolean
  predicted_type: string
  risk: number
  reward: number
  allowed: boolean
  rationale: string
}

export interface MetricsWire {
  steps: number
  total_risk: number
  peak_risk: number
  total_reward: number
  reaches_target: boolean
  violations: { position: Vec3; type: string }[]
}

export interface SimulationState {
  entry: Vec3
  mode: PlanningMode
  stepIndex: number
  isRunning: boolean
  hasStarted: boolean
  showFailed: boolean
  failureReason: string
  failedPath: Vec3[]
  plan: { path: Vec3[]; found: boolean; expanded: number; episodes: number }
  metrics: MetricsWire
  current: { position: Vec3; type: string; color: string; describe: string }
  prediction: PredictionWire | null
}

export interface CameraState {
  yaw: number
  pitch: number
  zoom: number
}

export interface HoverInfo {
  position: Vec3 | null
  type: string | null
}

export const sameCell = (a: Vec3, b: Vec3) =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

export const describeCoord = ([x, y, z]: Vec3): string => {
  const lateral = x <= 1 ? 'left' : 'right'
  const depth = y <= 1 ? 'anterior' : 'posterior'
  const height = z <= 1 ? 'inferior' : 'superior'
  return `${lateral} · ${depth} · ${height}`
}

export const fmtVec = (v: Vec3) => `[${v.join(', ')}]`
