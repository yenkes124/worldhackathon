import { CELL_META } from './cellMeta'
import { cellTypeAt, inBounds } from './grid'
import type {
  Action,
  ExploreObservation,
  ExplorePrediction,
  RiskBand,
  Vec3,
} from './types'

/**
 * Simulated safety check.
 *
 * This is the ONLY Explore and Learn module allowed to read hidden ground
 * truth. It returns an observation the agent folds into its knowledge map; no
 * other explore module inspects the synthetic environment directly.
 */
export const RESTRICTED_EXPLANATION =
  'Route rejected before execution: the synthetic environment revealed a restricted region.'

const riskBand = (risk: number): RiskBand =>
  risk >= 0.7 ? 'high' : risk >= 0.3 ? 'medium' : 'low'

interface ValidateExploreMoveInput {
  from: Vec3
  action: Action
  prediction: ExplorePrediction
  step: number
}

export const validateExploreMove = ({
  from,
  action,
  prediction,
  step,
}: ValidateExploreMoveInput): ExploreObservation => {
  const proposedPosition: Vec3 = [
    from[0] + action.delta[0],
    from[1] + action.delta[1],
    from[2] + action.delta[2],
  ]

  const base = {
    from,
    action,
    proposedPosition,
    step,
  }

  if (!inBounds(proposedPosition)) {
    return {
      ...base,
      allowedToAdvance: false,
      outcome: 'out_of_bounds',
      actualPosition: from,
      actualLabel: null,
      actualRisk: 'high',
      predictionMatched: !prediction.traversableAccordingToKnowledge,
      knowledgeUpdate: null,
      explanation:
        'Route rejected before execution: the proposed cell lies outside the synthetic environment.',
    }
  }

  const actualLabel = cellTypeAt(proposedPosition)
  const meta = CELL_META[actualLabel]
  const actualRisk = riskBand(meta.risk)

  if (meta.noGo) {
    return {
      ...base,
      allowedToAdvance: false,
      outcome: 'restricted',
      actualPosition: from,
      actualLabel,
      actualRisk,
      predictionMatched: !prediction.traversableAccordingToKnowledge,
      knowledgeUpdate: {
        position: proposedPosition,
        status: 'CONFIRMED_NO_GO',
        observedLabel: actualLabel,
        confidence: 100,
      },
      explanation: RESTRICTED_EXPLANATION,
    }
  }

  const isTarget = actualLabel === 'VIM_TARGET'
  const isEntry = actualLabel === 'ENT'

  return {
    ...base,
    allowedToAdvance: true,
    outcome: isTarget ? 'target' : 'safe',
    actualPosition: proposedPosition,
    actualLabel,
    actualRisk,
    predictionMatched: prediction.traversableAccordingToKnowledge,
    knowledgeUpdate: {
      position: proposedPosition,
      status: isTarget
        ? 'KNOWN_TARGET'
        : isEntry
          ? 'KNOWN_ENTRY'
          : 'CONFIRMED_SAFE',
      observedLabel: actualLabel,
      confidence: 100,
    },
    explanation: isTarget
      ? `Simulated safety check passed: [${proposedPosition.join(', ')}] is the fixed target cell.`
      : `Simulated safety check passed: [${proposedPosition.join(', ')}] is a permitted cell of the synthetic environment (${meta.name}).`,
  }
}
