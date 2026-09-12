import type { KnowledgeStatus } from './types'

/** State of the most recent simulated safety check, as the UI presents it. */
export type CheckVerdict = 'pending' | 'passed' | 'rejected'

/** Presentation of a knowledge status, shared by the panel legend and the scene. */
export interface KnowledgeView {
  label: string
  color: string
  /** Voxel opacity when the scene renders the agent's belief. */
  opacity: number
}

export const KNOWLEDGE_VIEW: Record<KnowledgeStatus, KnowledgeView> = {
  UNKNOWN: { label: 'Unknown', color: '#64748b', opacity: 0.16 },
  PREDICTED_SAFE: { label: 'Predicted safe', color: '#60a5fa', opacity: 0.3 },
  PREDICTED_RISK: { label: 'Predicted risk', color: '#fbbf24', opacity: 0.35 },
  CONFIRMED_SAFE: { label: 'Confirmed safe', color: '#34d399', opacity: 0.5 },
  CONFIRMED_NO_GO: { label: 'Confirmed restricted', color: '#ff4d6a', opacity: 0.72 },
  KNOWN_ENTRY: { label: 'Known entry', color: '#22d3ee', opacity: 0.5 },
  KNOWN_TARGET: { label: 'Known target', color: '#34ff9b', opacity: 0.95 },
}

/** Legend rows for the Explore knowledge map, in the order the UI shows them. */
export const KNOWLEDGE_LEGEND: KnowledgeStatus[] = [
  'UNKNOWN',
  'CONFIRMED_SAFE',
  'CONFIRMED_NO_GO',
  'KNOWN_ENTRY',
  'KNOWN_TARGET',
]
