import { create } from 'zustand'
import { CELL_META } from '../sim/cellMeta'
import { cellTypeAt, key, manhattan, sameCell } from '../sim/grid'
import { planAStar } from '../sim/planner'
import { bodyReaction, type BodyReaction } from '../sim/reactions'
import { RIGHT_HAND_TREMOR } from '../sim/scenario'
import type { CellType, PlanResult, Vec3 } from '../sim/types'
import { actionForStep } from '../sim/worldModel'
import { advance, cellOf, initialNav, type NavState, type Vertical } from './navigation'

export type ExplorerPhase =
  | 'idle'
  | 'connecting'
  | 'seeding'
  | 'exploring'
  | 'paused'
  | 'error'

export interface VisitLog {
  cell: Vec3
  type: CellType
  chunk: number
}

interface ExplorerState {
  phase: ExplorerPhase
  error: string | undefined
  nav: NavState
  vertical: Vertical
  cell: Vec3
  cellType: CellType
  reaction: BodyReaction
  /** Cheapest safe route from the current cell, recomputed on cell change. */
  suggestion: PlanResult
  suggestedAction: string | undefined
  visited: VisitLog[]
  noGoEntries: number
  accumulatedRisk: number
  reachedTarget: boolean
  chunk: number
  lastAction: string
  setPhase: (phase: ExplorerPhase, error?: string) => void
  setVertical: (vertical: Vertical) => void
  /** Apply one `chunk_complete` event from the world model. */
  onChunk: (chunk: number, activeAction: string) => void
  reset: () => void
}

const ENTRY = RIGHT_HAND_TREMOR.entries[1] ?? RIGHT_HAND_TREMOR.entries[0]
const TARGET = RIGHT_HAND_TREMOR.target

const suggest = (cell: Vec3) => {
  const suggestion = planAStar(cell, TARGET)
  const next = suggestion.path[1]
  const action = next ? actionForStep(cell, next) : undefined
  return {
    suggestion,
    suggestedAction: sameCell(cell, TARGET)
      ? 'Target reached — hold position'
      : action
        ? `${action.label} (${action.hint})`
        : 'No safe route from here — back out',
  }
}

const fresh = () => {
  const nav = initialNav(ENTRY)
  const cell = cellOf(nav.position)
  const cellType = cellTypeAt(cell)
  return {
    phase: 'idle' as ExplorerPhase,
    error: undefined,
    nav,
    vertical: 0 as Vertical,
    cell,
    cellType,
    reaction: bodyReaction(cellType),
    ...suggest(cell),
    visited: [{ cell, type: cellType, chunk: 0 }],
    noGoEntries: 0,
    accumulatedRisk: CELL_META[cellType].risk,
    reachedTarget: false,
    chunk: 0,
    lastAction: 'still',
  }
}

export const useExplorer = create<ExplorerState>((set, get) => ({
  ...fresh(),

  setPhase: (phase, error) => set({ phase, error }),
  setVertical: (vertical) => set({ vertical }),

  onChunk: (chunk, activeAction) => {
    const state = get()
    const nav = advance(state.nav, activeAction, state.vertical)
    const cell = cellOf(nav.position)
    if (sameCell(cell, state.cell)) {
      set({ nav, chunk, lastAction: activeAction })
      return
    }
    const cellType = cellTypeAt(cell)
    const meta = CELL_META[cellType]
    set({
      nav,
      chunk,
      lastAction: activeAction,
      cell,
      cellType,
      reaction: bodyReaction(cellType),
      ...suggest(cell),
      visited: [...state.visited, { cell, type: cellType, chunk }],
      noGoEntries: state.noGoEntries + (meta.noGo ? 1 : 0),
      accumulatedRisk: state.accumulatedRisk + meta.risk,
      reachedTarget: state.reachedTarget || sameCell(cell, TARGET),
    })
  },

  reset: () => set({ ...fresh(), phase: get().phase }),
}))

export const EXPLORER_ENTRY = ENTRY
export const EXPLORER_TARGET = TARGET
export const distanceToTarget = (cell: Vec3): number => manhattan(cell, TARGET)
export const cellKey = key
