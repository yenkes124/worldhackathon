import {
  getKnowledgeCell,
  sameKnowledgeCell,
  withinKnowledgeBounds,
} from './agentKnowledge'
import type {
  Action,
  ExplorePrediction,
  KnowledgeMap,
  KnowledgeStatus,
  RiskBand,
  Vec3,
} from './types'

/**
 * Knowledge-only prediction for one action.
 *
 * Nothing here may consult the hidden environment: the agent predicts from its
 * own knowledge map, and only the simulated safety check can confirm or refute
 * that prediction.
 */
interface PredictExploreInput {
  from: Vec3
  action: Action
  knowledge: KnowledgeMap
  target: Vec3
  step: number
}

interface StatusBelief {
  risk: RiskBand
  confidence: number
  traversable: boolean
  summary: string
}

const BELIEFS: Record<KnowledgeStatus, StatusBelief> = {
  KNOWN_ENTRY: {
    risk: 'low',
    confidence: 100,
    traversable: true,
    summary: 'a known entry cell',
  },
  KNOWN_TARGET: {
    risk: 'low',
    confidence: 100,
    traversable: true,
    summary: 'the known target cell',
  },
  CONFIRMED_SAFE: {
    risk: 'low',
    confidence: 100,
    traversable: true,
    summary: 'already confirmed safe by a simulated safety check',
  },
  PREDICTED_SAFE: {
    risk: 'low',
    confidence: 60,
    traversable: true,
    summary: 'predicted safe but not yet checked',
  },
  PREDICTED_RISK: {
    risk: 'high',
    confidence: 55,
    traversable: true,
    summary: 'predicted risky, so it is only considered at a high cost',
  },
  CONFIRMED_NO_GO: {
    risk: 'high',
    confidence: 100,
    traversable: false,
    summary: 'confirmed restricted, so the agent will not route through it',
  },
  UNKNOWN: {
    risk: 'unknown',
    confidence: 25,
    traversable: true,
    summary: 'unknown, so it may be traversable but needs a simulated safety check',
  },
}

export const predictExplore = ({
  from,
  action,
  knowledge,
  target,
  step,
}: PredictExploreInput): ExplorePrediction => {
  const predictedPosition: Vec3 = [
    from[0] + action.delta[0],
    from[1] + action.delta[1],
    from[2] + action.delta[2],
  ]
  const inBounds = withinKnowledgeBounds(predictedPosition)

  if (!inBounds) {
    return {
      from,
      action,
      predictedPosition,
      inBounds: false,
      predictedStatus: 'UNKNOWN',
      predictedLabel: null,
      predictedRisk: 'high',
      confidence: 100,
      traversableAccordingToKnowledge: false,
      explanation:
        'This step would leave the synthetic environment, so the agent treats it as high risk and not traversable.',
    }
  }

  const cell = getKnowledgeCell(knowledge, predictedPosition)
  const status: KnowledgeStatus = cell?.status ?? 'UNKNOWN'
  const belief = BELIEFS[status]
  const reachesTarget = sameKnowledgeCell(predictedPosition, target)
  const suffix = reachesTarget ? ' It is the fixed target cell.' : ''

  return {
    from,
    action,
    predictedPosition,
    inBounds: true,
    predictedStatus: status,
    predictedLabel: cell?.observedLabel ?? cell?.predictedLabel ?? null,
    predictedRisk: belief.risk,
    confidence: cell?.confidence ?? belief.confidence,
    traversableAccordingToKnowledge: belief.traversable,
    explanation: `Step ${step}: ${action.label} to [${predictedPosition.join(', ')}], which the knowledge map records as ${belief.summary}.${suffix}`,
  }
}
