import {
  getKnowledgeCell,
  knowledgeKey,
  sameKnowledgeCell,
  withinKnowledgeBounds,
} from './agentKnowledge'
import type {
  ExploreRouteResult,
  KnowledgeMap,
  KnowledgeStatus,
  Vec3,
} from './types'
// Only the action deltas are reused; the hidden environment is never read here.
import { ACTIONS } from './worldModel'

/** Cost of entering a cell, expressed purely in terms of agent knowledge. */
const ENTRY_COST: Record<KnowledgeStatus, number> = {
  KNOWN_TARGET: 1,
  KNOWN_ENTRY: 1,
  CONFIRMED_SAFE: 1,
  PREDICTED_SAFE: 3,
  UNKNOWN: 6,
  PREDICTED_RISK: 30,
  CONFIRMED_NO_GO: Infinity,
}

/**
 * The exploration policy resolves lateral alignment with the target before
 * committing to a depth change, because a descent is the expensive move to
 * undo. This is a knowledge-only preference, not a hint about hidden labels.
 */
const DEPTH_DEFERRAL_PENALTY = 8

const stepCost = (
  from: Vec3,
  to: Vec3,
  status: KnowledgeStatus,
  target: Vec3,
): number => {
  const base = ENTRY_COST[status]
  if (!Number.isFinite(base)) return Infinity
  const changesDepth = from[2] !== to[2]
  const lateralAligned = from[0] === target[0] && from[1] === target[1]
  return base + (changesDepth && !lateralAligned ? DEPTH_DEFERRAL_PENALTY : 0)
}

const noRoute = (
  from: Vec3,
  target: Vec3,
  expanded: number,
  explanation: string,
): ExploreRouteResult => ({
  found: false,
  from,
  target,
  route: [],
  totalCost: Infinity,
  expanded,
  unknownCells: 0,
  explanation,
})

/**
 * Deterministic Dijkstra over the knowledge map. Ties are broken by cost and
 * then by cell key, so an identical knowledge state always yields an identical
 * route. Never throws: an unreachable target returns a structured result.
 */
export const planExploreRoute = (
  from: Vec3,
  target: Vec3,
  knowledge: KnowledgeMap,
): ExploreRouteResult => {
  if (!withinKnowledgeBounds(from) || !withinKnowledgeBounds(target)) {
    return noRoute(
      from,
      target,
      0,
      'No route known: the start or target cell lies outside the synthetic environment.',
    )
  }

  const startStatus = getKnowledgeCell(knowledge, from)?.status ?? 'UNKNOWN'
  if (startStatus === 'CONFIRMED_NO_GO') {
    return noRoute(
      from,
      target,
      0,
      'No route known: the current cell is confirmed restricted.',
    )
  }

  const startKey = knowledgeKey(from)
  const dist = new Map<string, number>([[startKey, 0]])
  const cameFrom = new Map<string, Vec3>()
  const positions = new Map<string, Vec3>([[startKey, from]])
  const frontier = new Set<string>([startKey])
  const settled = new Set<string>()
  let expanded = 0

  while (frontier.size > 0) {
    let currentKey = ''
    let best = Infinity
    for (const candidate of [...frontier].sort()) {
      const cost = dist.get(candidate) ?? Infinity
      if (cost < best) {
        best = cost
        currentKey = candidate
      }
    }

    const current = positions.get(currentKey) as Vec3
    frontier.delete(currentKey)
    settled.add(currentKey)
    expanded += 1

    if (sameKnowledgeCell(current, target)) {
      const route: Vec3[] = [current]
      let cursor = currentKey
      while (cameFrom.has(cursor)) {
        const previous = cameFrom.get(cursor) as Vec3
        route.unshift(previous)
        cursor = knowledgeKey(previous)
      }
      const unknownCells = route.filter(
        (position) =>
          (getKnowledgeCell(knowledge, position)?.status ?? 'UNKNOWN') ===
          'UNKNOWN',
      ).length
      return {
        found: true,
        from,
        target,
        route,
        totalCost: best,
        expanded,
        unknownCells,
        explanation: `Counterfactual route over the knowledge map: ${route.length - 1} step(s), ${unknownCells} still unknown and awaiting a simulated safety check.`,
      }
    }

    for (const action of ACTIONS) {
      const next: Vec3 = [
        current[0] + action.delta[0],
        current[1] + action.delta[1],
        current[2] + action.delta[2],
      ]
      if (!withinKnowledgeBounds(next)) continue
      const nextKey = knowledgeKey(next)
      if (settled.has(nextKey)) continue
      const status = getKnowledgeCell(knowledge, next)?.status ?? 'UNKNOWN'
      const cost = stepCost(current, next, status, target)
      if (!Number.isFinite(cost)) continue
      const tentative = best + cost
      if (tentative < (dist.get(nextKey) ?? Infinity)) {
        dist.set(nextKey, tentative)
        cameFrom.set(nextKey, current)
        positions.set(nextKey, next)
        frontier.add(nextKey)
      }
    }
  }

  return noRoute(
    from,
    target,
    expanded,
    'No route known: every route the knowledge map allows is blocked by a confirmed restricted cell.',
  )
}
