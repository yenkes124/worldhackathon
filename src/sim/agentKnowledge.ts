import type { KnowledgeCell, KnowledgeMap, Vec3 } from './types'

/**
 * Agent-side knowledge of the synthetic environment.
 *
 * This module deliberately imports nothing from `grid.ts`: the agent only ever
 * learns about a cell through a simulated safety check. Grid extent is a
 * property of the map the agent is handed, not of hidden ground truth.
 */
export const KNOWLEDGE_GRID_SIZE = 4

export const knowledgeKey = ([x, y, z]: Vec3): string => `${x},${y},${z}`

export const withinKnowledgeBounds = ([x, y, z]: Vec3): boolean =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  Number.isInteger(z) &&
  x >= 0 &&
  x < KNOWLEDGE_GRID_SIZE &&
  y >= 0 &&
  y < KNOWLEDGE_GRID_SIZE &&
  z >= 0 &&
  z < KNOWLEDGE_GRID_SIZE

export const sameKnowledgeCell = (a: Vec3, b: Vec3): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

const unknownCell = (position: Vec3): KnowledgeCell => ({
  position,
  status: 'UNKNOWN',
  predictedLabel: null,
  predictedRisk: 'unknown',
  confidence: 10,
  observedLabel: null,
  observationCount: 0,
  lastUpdatedAtStep: 0,
})

/**
 * Entries and the fixed target are given to the agent up front. Everything else
 * starts UNKNOWN with no label, no risk band and no restriction flag.
 */
export const createInitialKnowledge = (
  entries: Vec3[],
  target: Vec3,
): KnowledgeMap => {
  const knowledge: KnowledgeMap = {}
  for (let z = 0; z < KNOWLEDGE_GRID_SIZE; z += 1) {
    for (let y = 0; y < KNOWLEDGE_GRID_SIZE; y += 1) {
      for (let x = 0; x < KNOWLEDGE_GRID_SIZE; x += 1) {
        const position: Vec3 = [x, y, z]
        knowledge[knowledgeKey(position)] = unknownCell(position)
      }
    }
  }

  for (const entry of entries) {
    knowledge[knowledgeKey(entry)] = {
      position: entry,
      status: 'KNOWN_ENTRY',
      predictedLabel: null,
      predictedRisk: 'low',
      confidence: 100,
      observedLabel: null,
      observationCount: 0,
      lastUpdatedAtStep: 0,
    }
  }

  knowledge[knowledgeKey(target)] = {
    position: target,
    status: 'KNOWN_TARGET',
    predictedLabel: null,
    predictedRisk: 'low',
    confidence: 100,
    observedLabel: null,
    observationCount: 0,
    lastUpdatedAtStep: 0,
  }

  return knowledge
}

export const getKnowledgeCell = (
  knowledge: KnowledgeMap,
  position: Vec3,
): KnowledgeCell | undefined => knowledge[knowledgeKey(position)]

/** Immutable update so store subscribers see a fresh map reference. */
export const updateKnowledgeCell = (
  knowledge: KnowledgeMap,
  position: Vec3,
  patch: Partial<Omit<KnowledgeCell, 'position'>>,
): KnowledgeMap => {
  const cellKey = knowledgeKey(position)
  const existing = knowledge[cellKey] ?? unknownCell(position)
  return {
    ...knowledge,
    [cellKey]: { ...existing, ...patch, position },
  }
}

export const knowledgeCells = (knowledge: KnowledgeMap): KnowledgeCell[] =>
  Object.keys(knowledge)
    .sort()
    .map((cellKey) => knowledge[cellKey])

export const countKnowledgeStatus = (
  knowledge: KnowledgeMap,
  status: KnowledgeCell['status'],
): number =>
  knowledgeCells(knowledge).filter((cell) => cell.status === status).length
