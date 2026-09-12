import { describe, expect, it } from 'vitest'
// Raw sources are asserted on directly: explore prediction and planning must
// never reach into the hidden environment.
import explorePlannerSource from './explorePlanner.ts?raw'
import explorePredictSource from './explorePredict.ts?raw'
import {
  createInitialKnowledge,
  getKnowledgeCell,
  knowledgeKey,
  updateKnowledgeCell,
} from './agentKnowledge'
import { planExploreRoute } from './explorePlanner'
import { predictExplore } from './explorePredict'
import { planAStar } from './planner'
import { RIGHT_HAND_TREMOR, VIM_TARGET_POSITION } from './scenario'
import {
  RESTRICTED_EXPLANATION,
  validateExploreMove,
} from './simulationValidator'
import { useSimulation } from '../state/simulationStore'
import type { ExploreObservation, KnowledgeMap, Vec3 } from './types'
import { actionById, actionForStep } from './worldModel'

const ENTRIES = RIGHT_HAND_TREMOR.entries
const TARGET = VIM_TARGET_POSITION

const freshKnowledge = (): KnowledgeMap =>
  createInitialKnowledge(ENTRIES, TARGET)

/** Applies an observation the way the store does, so tests share one path. */
const learn = (
  knowledge: KnowledgeMap,
  observation: ExploreObservation,
): KnowledgeMap => {
  const update = observation.knowledgeUpdate
  if (!update) return knowledge
  const previous = getKnowledgeCell(knowledge, update.position)
  return updateKnowledgeCell(knowledge, update.position, {
    status: update.status,
    observedLabel: update.observedLabel,
    predictedLabel: update.observedLabel,
    predictedRisk: observation.actualRisk,
    confidence: update.confidence,
    observationCount: (previous?.observationCount ?? 0) + 1,
    lastUpdatedAtStep: observation.step,
  })
}

const checkStep = (knowledge: KnowledgeMap, from: Vec3, to: Vec3, step = 1) => {
  const action = actionForStep(from, to)
  if (!action) throw new Error(`No single action from ${from} to ${to}`)
  const prediction = predictExplore({
    from,
    action,
    knowledge,
    target: TARGET,
    step,
  })
  const observation = validateExploreMove({ from, action, prediction, step })
  return { prediction, observation, knowledge: learn(knowledge, observation) }
}

describe('initial agent knowledge', () => {
  it('knows only the entries and the fixed target', () => {
    const knowledge = freshKnowledge()
    expect(Object.keys(knowledge)).toHaveLength(64)

    for (const entry of ENTRIES) {
      expect(getKnowledgeCell(knowledge, entry)?.status).toBe('KNOWN_ENTRY')
    }
    expect(getKnowledgeCell(knowledge, TARGET)?.status).toBe('KNOWN_TARGET')

    const known = new Set([...ENTRIES, TARGET].map(knowledgeKey))
    const others = Object.values(knowledge).filter(
      (cell) => !known.has(knowledgeKey(cell.position)),
    )
    expect(others).toHaveLength(64 - known.size)
    for (const cell of others) {
      expect(cell.status).toBe('UNKNOWN')
    }
  })

  it('exposes no hidden labels or restriction flags on unknown cells', () => {
    const knowledge = freshKnowledge()
    for (const cell of Object.values(knowledge)) {
      if (cell.status !== 'UNKNOWN') continue
      expect(cell.observedLabel ?? null).toBeNull()
      expect(cell.predictedLabel ?? null).toBeNull()
      expect(cell.predictedRisk).toBe('unknown')
      expect(cell.observationCount).toBe(0)
      expect(cell.confidence).toBeLessThan(50)
      expect(Object.keys(cell)).not.toContain('noGo')
    }
  })
})

describe('prediction isolation', () => {
  it('treats unknown cells as uncertain and low confidence', () => {
    const prediction = predictExplore({
      from: [0, 0, 3],
      action: actionById('Z_NEG'),
      knowledge: freshKnowledge(),
      target: TARGET,
      step: 1,
    })
    expect(prediction.predictedStatus).toBe('UNKNOWN')
    expect(prediction.predictedLabel).toBeNull()
    expect(prediction.predictedRisk).toBe('unknown')
    expect(prediction.confidence).toBeLessThan(50)
    expect(prediction.traversableAccordingToKnowledge).toBe(true)
  })

  it('treats confirmed restricted cells as high risk and not traversable', () => {
    const knowledge = updateKnowledgeCell(freshKnowledge(), [1, 1, 3], {
      status: 'CONFIRMED_NO_GO',
      observedLabel: 'MOT_HAND',
      confidence: 100,
    })
    const prediction = predictExplore({
      from: [1, 0, 3],
      action: actionById('Y_POS'),
      knowledge,
      target: TARGET,
      step: 2,
    })
    expect(prediction.predictedStatus).toBe('CONFIRMED_NO_GO')
    expect(prediction.predictedRisk).toBe('high')
    expect(prediction.traversableAccordingToKnowledge).toBe(false)
    expect(prediction.confidence).toBe(100)
  })

  it('rejects steps that leave the synthetic environment', () => {
    const prediction = predictExplore({
      from: [0, 0, 3],
      action: actionById('Z_POS'),
      knowledge: freshKnowledge(),
      target: TARGET,
      step: 1,
    })
    expect(prediction.inBounds).toBe(false)
    expect(prediction.traversableAccordingToKnowledge).toBe(false)
  })

  it('keeps prediction and planning free of ground-truth imports', () => {
    for (const source of [explorePredictSource, explorePlannerSource]) {
      expect(source).not.toContain('cellTypeAt')
      expect(source).not.toContain("from './grid'")
      expect(source).not.toContain('LAYERS')
      expect(source).not.toContain('CELL_META')
    }
  })
})

describe('observation learning', () => {
  it('confirms a safe cell and advances the probe', () => {
    const { prediction, observation, knowledge } = checkStep(
      freshKnowledge(),
      [1, 0, 3],
      [1, 0, 2],
    )
    expect(prediction.predictedLabel).toBeNull()
    expect(observation.allowedToAdvance).toBe(true)
    expect(observation.outcome).toBe('safe')
    expect(observation.actualPosition).toEqual([1, 0, 2])

    const cell = getKnowledgeCell(knowledge, [1, 0, 2])
    expect(cell?.status).toBe('CONFIRMED_SAFE')
    expect(cell?.observedLabel).toBe('WM_SAFE')
    expect(cell?.confidence).toBe(100)
    expect(cell?.observationCount).toBe(1)
  })

  it('reveals a restricted cell and keeps the probe at its previous position', () => {
    const { observation, knowledge } = checkStep(
      freshKnowledge(),
      [1, 0, 3],
      [1, 1, 3],
    )
    expect(observation.allowedToAdvance).toBe(false)
    expect(observation.outcome).toBe('restricted')
    expect(observation.actualPosition).toEqual([1, 0, 3])
    expect(observation.explanation).toBe(RESTRICTED_EXPLANATION)

    const cell = getKnowledgeCell(knowledge, [1, 1, 3])
    expect(cell?.status).toBe('CONFIRMED_NO_GO')
    expect(cell?.observedLabel).toBe('MOT_HAND')
    expect(cell?.confidence).toBe(100)
  })

  it('records the target and reports out-of-bounds steps as structured results', () => {
    const reachTarget = checkStep(freshKnowledge(), [1, 1, 2], TARGET)
    expect(reachTarget.observation.outcome).toBe('target')
    expect(
      getKnowledgeCell(reachTarget.knowledge, TARGET)?.status,
    ).toBe('KNOWN_TARGET')

    const knowledge = freshKnowledge()
    const action = actionById('Z_POS')
    const from: Vec3 = [0, 0, 3]
    const prediction = predictExplore({
      from,
      action,
      knowledge,
      target: TARGET,
      step: 1,
    })
    const observation = validateExploreMove({ from, action, prediction, step: 1 })
    expect(observation.outcome).toBe('out_of_bounds')
    expect(observation.allowedToAdvance).toBe(false)
    expect(observation.actualPosition).toEqual(from)
    expect(observation.knowledgeUpdate).toBeNull()
  })

  it('populates an observed label only after the cell has been observed', () => {
    const knowledge = freshKnowledge()
    expect(getKnowledgeCell(knowledge, [1, 0, 2])?.observedLabel ?? null).toBeNull()
    const learned = checkStep(knowledge, [1, 0, 3], [1, 0, 2]).knowledge
    expect(getKnowledgeCell(learned, [1, 0, 2])?.observedLabel).toBe('WM_SAFE')
  })
})

describe('explore planning and replanning', () => {
  it('proposes a deterministic route that crosses an unknown cell', () => {
    const knowledge = freshKnowledge()
    const first = planExploreRoute(ENTRIES[0], TARGET, knowledge)
    const second = planExploreRoute(ENTRIES[0], TARGET, knowledge)
    expect(first.found).toBe(true)
    expect(first.route).toEqual(second.route)
    expect(first.unknownCells).toBeGreaterThan(0)
    expect(first.route.map(knowledgeKey)).toContain(knowledgeKey([1, 1, 3]))
  })

  it('routes every entry through the restricted cell it must discover', () => {
    for (const entry of ENTRIES) {
      const route = planExploreRoute(entry, TARGET, freshKnowledge())
      expect(route.found).toBe(true)
      expect(route.route.map(knowledgeKey)).toContain(knowledgeKey([1, 1, 3]))
    }
  })

  it('excludes a confirmed restricted cell after replanning and still reaches the target', () => {
    let knowledge = freshKnowledge()
    let position: Vec3 = ENTRIES[0]
    let step = 0
    let discoveries = 0

    for (let guard = 0; guard < 24; guard += 1) {
      const route = planExploreRoute(position, TARGET, knowledge)
      expect(route.found).toBe(true)
      const next = route.route[1]
      if (!next) break
      step += 1
      const outcome = checkStep(knowledge, position, next, step)
      knowledge = outcome.knowledge
      if (outcome.observation.allowedToAdvance) {
        position = outcome.observation.actualPosition
      } else {
        discoveries += 1
        const replan = planExploreRoute(position, TARGET, knowledge)
        expect(replan.route.map(knowledgeKey)).not.toContain(knowledgeKey(next))
      }
      if (position[0] === TARGET[0] && position[1] === TARGET[1] && position[2] === TARGET[2]) {
        break
      }
    }

    expect(discoveries).toBeGreaterThanOrEqual(1)
    expect(position).toEqual(TARGET)
    expect(getKnowledgeCell(knowledge, [1, 1, 3])?.status).toBe('CONFIRMED_NO_GO')
  })

  it('returns a structured "no route known" result instead of throwing', () => {
    let knowledge = freshKnowledge()
    const from: Vec3 = [0, 0, 3]
    for (const neighbour of [
      [1, 0, 3],
      [0, 1, 3],
      [0, 0, 2],
    ] as Vec3[]) {
      knowledge = updateKnowledgeCell(knowledge, neighbour, {
        status: 'CONFIRMED_NO_GO',
        observedLabel: 'IC_AVOID',
        confidence: 100,
      })
    }
    const route = planExploreRoute(from, TARGET, knowledge)
    expect(route.found).toBe(false)
    expect(route.route).toHaveLength(0)
    expect(route.explanation).toMatch(/No route known/)
  })
})

describe('explore session in the store', () => {
  it('discovers a restricted cell, keeps the probe put, and replans to the target', () => {
    const store = useSimulation
    store.getState().setMode('explore')
    store.getState().startExploreSession(ENTRIES[0])

    let discovered = false
    for (let guard = 0; guard < 24; guard += 1) {
      const before = store.getState().exploreCurrentPosition
      store.getState().predictExploreAction()
      const observation = store.getState().validateExploreAction()
      if (!observation) break
      if (observation.outcome === 'restricted') {
        discovered = true
        expect(store.getState().exploreCurrentPosition).toEqual(before)
        expect(store.getState().exploreDecisionLog).toContain(
          RESTRICTED_EXPLANATION,
        )
        expect(store.getState().exploreMetrics.restrictedCellsDiscovered).toBe(1)
        const replan = store.getState().replanExploreRoute()
        expect(replan.found).toBe(true)
        expect(replan.route.map(knowledgeKey)).not.toContain(
          knowledgeKey(observation.proposedPosition),
        )
      }
      if (observation.outcome === 'target') break
      if (!store.getState().exploreRouteProposal?.found) break
    }

    expect(discovered).toBe(true)
    expect(store.getState().exploreCurrentPosition).toEqual(TARGET)
    expect(store.getState().exploreMetrics.safeCellsConfirmed).toBeGreaterThan(0)
    expect(store.getState().mode).toBe('explore')
    // Guided state is untouched by the explore session.
    expect(store.getState().planningMode).toBe('astar')
    expect(store.getState().plan.found).toBe(true)
    expect(store.getState().stepIndex).toBe(0)

    store.getState().resetExploreSession()
    expect(store.getState().exploreCurrentPosition).toEqual(ENTRIES[0])
    expect(store.getState().exploreDecisionLog).toHaveLength(0)
    store.getState().setMode('guided')
  })
})

describe('guided planner regression', () => {
  it('still finds a safe full-map route from every entry', () => {
    for (const entry of ENTRIES) {
      const plan = planAStar(entry, TARGET)
      expect(plan.found).toBe(true)
      expect(plan.evaluation.reachesTarget).toBe(true)
      expect(plan.evaluation.violations).toHaveLength(0)
    }
  })
})
