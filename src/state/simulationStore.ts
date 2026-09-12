import { create } from 'zustand'
import {
  evaluatePath,
  explainFailure,
  naiveUnsafePath,
  planAStar,
  runLearner,
} from '../sim/planner'
import { HIGHLIGHT_CONTEXT, RIGHT_HAND_TREMOR } from '../sim/scenario'
import type {
  LearnerResult,
  PathEvaluation,
  PlanResult,
  Prediction,
  Scenario,
  Vec3,
} from '../sim/types'
import { actionForStep, predictTransition } from '../sim/worldModel'

export type PlanningMode = 'astar' | 'learner'

interface SimulationState {
  scenario: Scenario
  highlightContext: Vec3[]
  entry: Vec3
  mode: PlanningMode
  plan: PlanResult | LearnerResult
  stepIndex: number
  isRunning: boolean
  hasStarted: boolean
  showFailed: boolean
  failedPath: Vec3[]
  failureReason: string
  setEntry: (entry: Vec3) => void
  setMode: (mode: PlanningMode) => void
  start: () => void
  run: () => void
  pause: () => void
  reset: () => void
  step: () => void
  tick: () => void
  toggleFailed: () => void
}

const buildPlan = (
  mode: PlanningMode,
  entry: Vec3,
  scenario: Scenario,
): PlanResult | LearnerResult =>
  mode === 'astar'
    ? planAStar(entry, scenario.target)
    : runLearner(entry, scenario.target, scenario.seed)

const initialEntry = RIGHT_HAND_TREMOR.entries[1] ?? RIGHT_HAND_TREMOR.entries[0]

export const useSimulation = create<SimulationState>((set, get) => ({
  scenario: RIGHT_HAND_TREMOR,
  highlightContext: HIGHLIGHT_CONTEXT,
  entry: initialEntry,
  mode: 'astar',
  plan: buildPlan('astar', initialEntry, RIGHT_HAND_TREMOR),
  stepIndex: 0,
  isRunning: false,
  hasStarted: false,
  showFailed: false,
  failedPath: naiveUnsafePath(initialEntry, RIGHT_HAND_TREMOR.target),
  failureReason: explainFailure(
    naiveUnsafePath(initialEntry, RIGHT_HAND_TREMOR.target),
    RIGHT_HAND_TREMOR.target,
  ),

  setEntry: (entry) => {
    const { mode, scenario } = get()
    const failedPath = naiveUnsafePath(entry, scenario.target)
    set({
      entry,
      plan: buildPlan(mode, entry, scenario),
      stepIndex: 0,
      isRunning: false,
      failedPath,
      failureReason: explainFailure(failedPath, scenario.target),
    })
  },

  setMode: (mode) => {
    const { entry, scenario } = get()
    set({
      mode,
      plan: buildPlan(mode, entry, scenario),
      stepIndex: 0,
      isRunning: false,
    })
  },

  start: () => set({ hasStarted: true }),
  run: () => {
    const { plan, stepIndex } = get()
    if (!plan.found) return
    set({
      isRunning: true,
      stepIndex: stepIndex >= plan.path.length - 1 ? 0 : stepIndex,
    })
  },
  pause: () => set({ isRunning: false }),
  reset: () => set({ stepIndex: 0, isRunning: false }),
  step: () => {
    const { plan, stepIndex } = get()
    if (!plan.found) return
    const next = Math.min(stepIndex + 1, plan.path.length - 1)
    set({ stepIndex: next, isRunning: false })
  },
  tick: () => {
    const { plan, stepIndex, isRunning } = get()
    if (!isRunning || !plan.found) return
    if (stepIndex >= plan.path.length - 1) {
      set({ isRunning: false })
      return
    }
    set({ stepIndex: stepIndex + 1 })
  },
  toggleFailed: () => set((state) => ({ showFailed: !state.showFailed })),
}))

export const selectCurrentPosition = (state: SimulationState): Vec3 =>
  state.plan.path[state.stepIndex] ?? state.entry

// Derived objects are cached on their inputs so subscribers get a stable
// reference and useSyncExternalStore does not loop.
const cacheOnArgs = <A, B, T>(compute: (a: A, b: B) => T) => {
  let cached: { a: A; b: B; value: T } | undefined
  return (a: A, b: B): T => {
    if (!cached || cached.a !== a || cached.b !== b) {
      cached = { a, b, value: compute(a, b) }
    }
    return cached.value
  }
}

const predictionForStep = cacheOnArgs<Vec3[], number, Prediction | null>(
  (path, stepIndex) => {
    const from = path[stepIndex]
    const to = path[stepIndex + 1]
    if (!from || !to) return null
    const action = actionForStep(from, to)
    if (!action) return null
    return predictTransition(from, action)
  },
)

export const selectPrediction = (state: SimulationState): Prediction | null =>
  predictionForStep(state.plan.path, state.stepIndex)

const evaluationForPath = cacheOnArgs<Vec3[], Vec3, PathEvaluation>(
  evaluatePath,
)

export const selectMetrics = (state: SimulationState): PathEvaluation =>
  evaluationForPath(state.plan.path, state.scenario.target)
