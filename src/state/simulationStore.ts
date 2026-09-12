import { create } from 'zustand'
import {
  countKnowledgeStatus,
  createInitialKnowledge,
  getKnowledgeCell,
  updateKnowledgeCell,
} from '../sim/agentKnowledge'
import { planExploreRoute } from '../sim/explorePlanner'
import { predictExplore } from '../sim/explorePredict'
import {
  evaluatePath,
  explainFailure,
  naiveUnsafePath,
  planAStar,
  runLearner,
} from '../sim/planner'
import { HIGHLIGHT_CONTEXT, RIGHT_HAND_TREMOR } from '../sim/scenario'
import { validateExploreMove } from '../sim/simulationValidator'
import type {
  Action,
  ExploreObservation,
  ExplorePrediction,
  ExploreRouteResult,
  KnowledgeMap,
  LearnerResult,
  PathEvaluation,
  PlanResult,
  Prediction,
  Scenario,
  Vec3,
} from '../sim/types'
import { actionForStep, predictTransition } from '../sim/worldModel'

export type PlanningMode = 'astar' | 'learner'
export type AppMode = 'guided' | 'explore'

export interface ExploreMetrics {
  predictionsTested: number
  predictionsMatched: number
  safeCellsConfirmed: number
  restrictedCellsDiscovered: number
  replansCompleted: number
}

interface SimulationState {
  scenario: Scenario
  highlightContext: Vec3[]
  entry: Vec3
  mode: AppMode
  planningMode: PlanningMode
  plan: PlanResult | LearnerResult
  stepIndex: number
  isRunning: boolean
  hasStarted: boolean
  showFailed: boolean
  failedPath: Vec3[]
  failureReason: string

  exploreEntry: Vec3
  exploreStarted: boolean
  exploreKnowledgeMap: KnowledgeMap
  exploreTargetPosition: Vec3
  exploreCurrentPosition: Vec3
  exploreVisitedPath: Vec3[]
  exploreStepNumber: number
  exploreDecisionLog: string[]
  lastExplorePrediction: ExplorePrediction | null
  lastExploreObservation: ExploreObservation | null
  exploreRouteProposal: ExploreRouteResult | null
  exploreMetrics: ExploreMetrics

  setEntry: (entry: Vec3) => void
  setMode: (mode: AppMode) => void
  setPlanningMode: (mode: PlanningMode) => void
  start: () => void
  run: () => void
  pause: () => void
  reset: () => void
  step: () => void
  tick: () => void
  toggleFailed: () => void

  setExploreEntry: (entry: Vec3) => void
  startExploreSession: (entryPosition: Vec3) => void
  resetExploreSession: () => void
  predictExploreAction: (action?: Action) => ExplorePrediction | null
  validateExploreAction: (action?: Action) => ExploreObservation | null
  applyExploreObservation: (observation: ExploreObservation) => void
  proposeExploreRoute: () => ExploreRouteResult
  replanExploreRoute: () => ExploreRouteResult
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
const initialExploreEntry = RIGHT_HAND_TREMOR.entries[0]

const emptyExploreMetrics = (): ExploreMetrics => ({
  predictionsTested: 0,
  predictionsMatched: 0,
  safeCellsConfirmed: 0,
  restrictedCellsDiscovered: 0,
  replansCompleted: 0,
})

const freshExploreSession = (entry: Vec3) => ({
  exploreEntry: entry,
  exploreStarted: false,
  exploreKnowledgeMap: createInitialKnowledge(
    RIGHT_HAND_TREMOR.entries,
    RIGHT_HAND_TREMOR.target,
  ),
  exploreCurrentPosition: entry,
  exploreVisitedPath: [entry],
  exploreStepNumber: 0,
  exploreDecisionLog: [] as string[],
  lastExplorePrediction: null,
  lastExploreObservation: null,
  exploreRouteProposal: null,
  exploreMetrics: emptyExploreMetrics(),
})

export const useSimulation = create<SimulationState>((set, get) => ({
  scenario: RIGHT_HAND_TREMOR,
  highlightContext: HIGHLIGHT_CONTEXT,
  entry: initialEntry,
  mode: 'guided',
  planningMode: 'astar',
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

  exploreTargetPosition: RIGHT_HAND_TREMOR.target,
  ...freshExploreSession(initialExploreEntry),

  setEntry: (entry) => {
    const { planningMode, scenario } = get()
    const failedPath = naiveUnsafePath(entry, scenario.target)
    set({
      entry,
      plan: buildPlan(planningMode, entry, scenario),
      stepIndex: 0,
      isRunning: false,
      failedPath,
      failureReason: explainFailure(failedPath, scenario.target),
    })
  },

  setMode: (mode) => set({ mode, isRunning: false }),

  setPlanningMode: (planningMode) => {
    const { entry, scenario } = get()
    set({
      planningMode,
      plan: buildPlan(planningMode, entry, scenario),
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

  setExploreEntry: (entry) => set(freshExploreSession(entry)),

  startExploreSession: (entryPosition) => {
    set({
      ...freshExploreSession(entryPosition),
      exploreStarted: true,
      exploreDecisionLog: [
        `Explore session started at entry [${entryPosition.join(', ')}] with an incomplete knowledge map.`,
      ],
    })
    get().proposeExploreRoute()
  },

  resetExploreSession: () => {
    const { exploreEntry } = get()
    set(freshExploreSession(exploreEntry))
  },

  predictExploreAction: (action) => {
    const state = get()
    const resolved = action ?? nextExploreAction(state)
    if (!resolved) return null
    const prediction = predictExplore({
      from: state.exploreCurrentPosition,
      action: resolved,
      knowledge: state.exploreKnowledgeMap,
      target: state.exploreTargetPosition,
      step: state.exploreStepNumber + 1,
    })
    set({
      lastExplorePrediction: prediction,
      exploreDecisionLog: [...state.exploreDecisionLog, prediction.explanation],
    })
    return prediction
  },

  validateExploreAction: (action) => {
    const state = get()
    const resolved =
      action ?? state.lastExplorePrediction?.action ?? nextExploreAction(state)
    if (!resolved) return null

    const prediction =
      state.lastExplorePrediction &&
      state.lastExplorePrediction.action.id === resolved.id &&
      sameVec(state.lastExplorePrediction.from, state.exploreCurrentPosition)
        ? state.lastExplorePrediction
        : predictExplore({
            from: state.exploreCurrentPosition,
            action: resolved,
            knowledge: state.exploreKnowledgeMap,
            target: state.exploreTargetPosition,
            step: state.exploreStepNumber + 1,
          })

    const observation = validateExploreMove({
      from: state.exploreCurrentPosition,
      action: resolved,
      prediction,
      step: state.exploreStepNumber + 1,
    })

    set({ lastExplorePrediction: prediction })
    get().applyExploreObservation(observation)
    return observation
  },

  applyExploreObservation: (observation) => {
    const state = get()
    const step = observation.step
    const update = observation.knowledgeUpdate
    const previous = update
      ? getKnowledgeCell(state.exploreKnowledgeMap, update.position)
      : undefined

    const knowledge = update
      ? updateKnowledgeCell(state.exploreKnowledgeMap, update.position, {
          status: update.status,
          observedLabel: update.observedLabel,
          predictedLabel: update.observedLabel,
          predictedRisk: observation.actualRisk,
          confidence: update.confidence,
          observationCount: (previous?.observationCount ?? 0) + 1,
          lastUpdatedAtStep: step,
        })
      : state.exploreKnowledgeMap

    const firstObservation = (previous?.observationCount ?? 0) === 0
    const metrics: ExploreMetrics = {
      ...state.exploreMetrics,
      predictionsTested: state.exploreMetrics.predictionsTested + 1,
      predictionsMatched:
        state.exploreMetrics.predictionsMatched +
        (observation.predictionMatched ? 1 : 0),
      safeCellsConfirmed:
        state.exploreMetrics.safeCellsConfirmed +
        (observation.allowedToAdvance && firstObservation ? 1 : 0),
      restrictedCellsDiscovered:
        state.exploreMetrics.restrictedCellsDiscovered +
        (observation.outcome === 'restricted' && firstObservation ? 1 : 0),
    }

    set({
      exploreKnowledgeMap: knowledge,
      exploreCurrentPosition: observation.actualPosition,
      exploreVisitedPath: observation.allowedToAdvance
        ? [...state.exploreVisitedPath, observation.actualPosition]
        : state.exploreVisitedPath,
      exploreStepNumber: step,
      exploreDecisionLog: [...state.exploreDecisionLog, observation.explanation],
      lastExploreObservation: observation,
      exploreMetrics: metrics,
    })
  },

  proposeExploreRoute: () => {
    const state = get()
    const proposal = planExploreRoute(
      state.exploreCurrentPosition,
      state.exploreTargetPosition,
      state.exploreKnowledgeMap,
    )
    set({
      exploreRouteProposal: proposal,
      exploreDecisionLog: [...state.exploreDecisionLog, proposal.explanation],
    })
    return proposal
  },

  replanExploreRoute: () => {
    const proposal = get().proposeExploreRoute()
    set((current) => ({
      exploreMetrics: {
        ...current.exploreMetrics,
        replansCompleted: current.exploreMetrics.replansCompleted + 1,
      },
    }))
    return proposal
  },
}))

const sameVec = (a: Vec3, b: Vec3): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

/** Next action along the current knowledge-only route proposal, if any. */
const nextExploreAction = (state: SimulationState): Action | undefined => {
  const route = state.exploreRouteProposal?.route ?? []
  const index = route.findIndex((position) =>
    sameVec(position, state.exploreCurrentPosition),
  )
  if (index < 0) return undefined
  const next = route[index + 1]
  if (!next) return undefined
  return actionForStep(state.exploreCurrentPosition, next)
}

export const selectCurrentPosition = (state: SimulationState): Vec3 =>
  state.plan.path[state.stepIndex] ?? state.entry

export const selectNextExploreAction = (
  state: SimulationState,
): Action | undefined => nextExploreAction(state)

export const selectExploreAccuracy = (state: SimulationState): number | null => {
  const { predictionsTested, predictionsMatched } = state.exploreMetrics
  if (predictionsTested === 0) return null
  return Math.round((predictionsMatched / predictionsTested) * 100)
}

export const selectConfirmedSafeCount = (state: SimulationState): number =>
  countKnowledgeStatus(state.exploreKnowledgeMap, 'CONFIRMED_SAFE')

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
