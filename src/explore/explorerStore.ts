import { create } from 'zustand'
import { CELL_META } from '../sim/cellMeta'
import { cellTypeAt, key, manhattan, sameCell } from '../sim/grid'
import { planAStar } from '../sim/planner'
import { bodyReaction, type BodyReaction } from '../sim/reactions'
import { RIGHT_HAND_TREMOR } from '../sim/scenario'
import type { CellType, PlanResult, Vec3 } from '../sim/types'
import { actionForStep } from '../sim/worldModel'
import { advance, cellOf, initialNav, type NavState, type Vertical } from './navigation'

export type ExplorerPhase = 'idle' | 'connecting' | 'seeding' | 'exploring' | 'paused' | 'error'

/** Which hosted Reactor world model renders the scenery. */
export type WorldEngine = 'lingbot' | 'happyoyster'

export interface VisitLog {
  cell: Vec3
  type: CellType
  chunk: number
}

interface ExplorerState {
  phase: ExplorerPhase
  error: string | undefined
  engine: WorldEngine
  /** Set when the engine was switched automatically after a capacity failure. */
  fallbackReason: string | undefined
  /** ENT cell the dive starts from; chosen on the exterior brain view. */
  entry: Vec3
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
  setEngine: (engine: WorldEngine, fallbackReason?: string) => void
  setEntry: (entry: Vec3) => void
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

const fresh = (entry: Vec3 = ENTRY) => {
  const nav = initialNav(entry)
  const cell = cellOf(nav.position)
  const cellType = cellTypeAt(cell)
  return {
    phase: 'idle' as ExplorerPhase,
    error: undefined,
    entry,
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
  engine: 'lingbot',
  fallbackReason: undefined,

  setPhase: (phase, error) => set({ phase, error }),
  setEngine: (engine, fallbackReason) => set({ engine, fallbackReason }),
  setEntry: (entry) => set({ ...fresh(entry), phase: get().phase }),
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

  reset: () => set({ ...fresh(get().entry), phase: get().phase }),
}))

export const EXPLORER_ENTRY = ENTRY
export const EXPLORER_TARGET = TARGET
export const distanceToTarget = (cell: Vec3): number => manhattan(cell, TARGET)
export const cellKey = key
