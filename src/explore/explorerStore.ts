import { create } from 'zustand'
import { CELL_META } from '../sim/cellMeta'
import { cellTypeAt, key, manhattan, sameCell } from '../sim/grid'
import { planAStar } from '../sim/planner'
import { bodyReaction, type BodyReaction } from '../sim/reactions'
import { RIGHT_HAND_TREMOR } from '../sim/scenario'
import type { Action, CellType, PlanResult, Prediction, Vec3 } from '../sim/types'
import { ACTIONS, actionForStep, predictTransition } from '../sim/worldModel'
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
  /** True once the user has left the exterior view for the interior stream. */
  dived: boolean
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
  setDived: (dived: boolean) => void
  setVertical: (vertical: Vertical) => void
  /** Move one node along `action`; returns the transition that was applied, or undefined if it leaves the volume. */
  step: (action: Action) => Prediction | undefined
  /** Re-centre the dead-reckoned position on the current node after a scripted travel. */
  settle: (heading?: number) => void
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

/** State delta for arriving in `cell` (a different cell from the current one). */
const enterCell = (state: ExplorerState, nav: NavState, cell: Vec3, chunk: number) => {
  const cellType = cellTypeAt(cell)
  const meta = CELL_META[cellType]
  return {
    nav,
    chunk,
    cell,
    cellType,
    reaction: bodyReaction(cellType),
    ...suggest(cell),
    visited: [...state.visited, { cell, type: cellType, chunk }],
    noGoEntries: state.noGoEntries + (meta.noGo ? 1 : 0),
    accumulatedRisk: state.accumulatedRisk + meta.risk,
    reachedTarget: state.reachedTarget || sameCell(cell, TARGET),
  }
}

export const useExplorer = create<ExplorerState>((set, get) => ({
  ...fresh(),
  engine: 'lingbot',
  fallbackReason: undefined,
  dived: false,

  setPhase: (phase, error) => set({ phase, error }),
  setEngine: (engine, fallbackReason) => set({ engine, fallbackReason }),
  setEntry: (entry) => set({ ...fresh(entry), phase: get().phase }),
  setDived: (dived) => set({ dived }),
  setVertical: (vertical) => set({ vertical }),

  step: (action) => {
    const state = get()
    const prediction = predictTransition(state.cell, action)
    if (!prediction.inBounds || prediction.predictedType === 'OUTSIDE') return undefined
    const heading = headingFor(action) ?? state.nav.heading
    const nav: NavState = { position: prediction.to, heading }
    set({
      ...enterCell(state, nav, prediction.to, state.chunk),
      lastAction: action.id,
    })
    return prediction
  },

  settle: (heading) =>
    set((state) => ({
      nav: { position: state.cell, heading: heading ?? state.nav.heading },
    })),

  onChunk: (chunk, activeAction) => {
    const state = get()
    const nav = advance(state.nav, activeAction, state.vertical)
    const cell = cellOf(nav.position)
    if (sameCell(cell, state.cell)) {
      set({ nav, chunk, lastAction: activeAction })
      return
    }
    set({ ...enterCell(state, nav, cell, chunk), lastAction: activeAction })
  },

  reset: () => set({ ...fresh(get().entry), phase: get().phase }),
}))

/** Compass heading (0 = posterior/+y, 90 = right/+x) a horizontal step faces; undefined for vertical. */
export const headingFor = (action: Action): number | undefined => {
  const [dx, dy] = action.delta
  if (dx === 0 && dy === 0) return undefined
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360
}

/** Signed shortest turn from `from` to `to`, in degrees (positive = clockwise/right). */
export const turnBetween = (from: number, to: number): number =>
  ((((to - from) % 360) + 540) % 360) - 180

/** The six neighbouring nodes of `cell` with the world model's verdict on each. */
export const moveOptions = (cell: Vec3): Prediction[] =>
  ACTIONS.map((action) => predictTransition(cell, action))

export const EXPLORER_ENTRY = ENTRY
export const EXPLORER_TARGET = TARGET
export const distanceToTarget = (cell: Vec3): number => manhattan(cell, TARGET)
export const cellKey = key
