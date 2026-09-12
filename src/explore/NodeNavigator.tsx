import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Compass,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { CELL_META } from '../sim/cellMeta'
import { describeCoord, sameCell } from '../sim/grid'
import type { Action, ActionId, Prediction } from '../sim/types'
import { EXPLORER_TARGET, moveOptions, useExplorer } from './explorerStore'

const ICONS: Record<ActionId, ComponentType<{ className?: string }>> = {
  X_NEG: ArrowLeft,
  X_POS: ArrowRight,
  Y_NEG: ArrowUp,
  Y_POS: ArrowDown,
  Z_POS: ChevronsUp,
  Z_NEG: ChevronsDown,
}

/** Layout: anterior / left·right / posterior on the left, superior / inferior on the right. */
const LAYOUT: ActionId[][] = [
  ['Y_NEG', 'Z_POS'],
  ['X_NEG', 'X_POS'],
  ['Y_POS', 'Z_NEG'],
]

const verdict = (move: Prediction) => {
  if (!move.inBounds || move.predictedType === 'OUTSIDE') {
    return {
      tone: 'outside' as const,
      label: 'Outside',
      why: move.inBounds ? CELL_META.OUTSIDE.description : move.rationale,
    }
  }
  const meta = CELL_META[move.predictedType]
  if (meta.noGo) {
    return {
      tone: 'nogo' as const,
      label: 'No-go',
      why: `${meta.name} — entering triggers the synthetic body response.`,
    }
  }
  return {
    tone: 'ok' as const,
    label: `Risk ${meta.risk.toFixed(2)}`,
    why: `${meta.name} — ${meta.description}`,
  }
}

const TONE_CLASS = {
  ok: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20',
  nogo: 'border-rose-400/40 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20',
  outside: 'border-slate-800 bg-slate-950/40 text-slate-600',
}

interface Props {
  onStep: (action: Action) => void
  busy?: boolean
}

/**
 * Node-to-node controls for the interior view: where the probe is, what each
 * neighbouring node is and why it is or isn't permitted, and the planner's
 * recommended next node.
 */
export const NodeNavigator = ({ onStep, busy = false }: Props) => {
  const cell = useExplorer((s) => s.cell)
  const cellType = useExplorer((s) => s.cellType)
  const suggestion = useExplorer((s) => s.suggestion)
  const meta = CELL_META[cellType]
  const moves = moveOptions(cell)
  const byId = new Map(moves.map((move) => [move.action.id, move]))
  const next = suggestion.path[1]
  const atTarget = sameCell(cell, EXPLORER_TARGET)
  const remaining = suggestion.path.slice(1)

  return (
    <div className="glass w-[21rem] rounded-xl p-3 text-[11px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] tracking-wide text-slate-500 uppercase">Current node</p>
          <p className="font-mono text-[14px] text-slate-50">[{cell.join(', ')}]</p>
          <p className="text-slate-400">{describeCoord(cell)}</p>
        </div>
        <span
          className={`rounded-md border px-2 py-1 text-right ${
            meta.noGo
              ? 'border-rose-400/40 bg-rose-500/10 text-rose-100'
              : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          <span className="block font-semibold">{meta.name}</span>
          <span className="block text-[10px] opacity-80">
            {meta.noGo ? 'no-go tissue' : `permitted · risk ${meta.risk.toFixed(2)}`}
          </span>
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {LAYOUT.flat().map((id) => {
          const move = byId.get(id)
          if (!move) return null
          const v = verdict(move)
          const Icon = ICONS[id]
          const recommended = next !== undefined && sameCell(move.to, next)
          const disabled = busy || v.tone === 'outside'
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              title={v.why}
              onClick={() => onStep(move.action)}
              className={`relative flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${TONE_CLASS[v.tone]} ${
                recommended ? 'ring-2 ring-sky-400/70' : ''
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{move.action.label}</span>
                <span className="block truncate font-mono text-[10px] opacity-80">
                  [{move.to.join(',')}] · {v.label}
                </span>
              </span>
              {recommended && (
                <span className="absolute -top-1.5 right-1.5 rounded bg-sky-400 px-1 text-[9px] font-semibold text-slate-950">
                  A* next
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-700/60 bg-slate-950/60 px-2.5 py-2 text-slate-300">
        <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300" aria-hidden />
        <div className="min-w-0">
          {atTarget ? (
            <p className="text-emerald-200">Target node reached: {meta.name}. Hold position.</p>
          ) : suggestion.found ? (
            <>
              <p>
                {remaining.length} safe {remaining.length === 1 ? 'step' : 'steps'} to the target{' '}
                <span className="font-mono text-slate-100">[{EXPLORER_TARGET.join(', ')}]</span>
              </p>
              <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                {remaining.map((c) => `[${c.join(',')}]`).join(' → ')}
              </p>
            </>
          ) : (
            <p className="text-amber-200">
              No safe route from this node — back out to a permitted one.
            </p>
          )}
          <p className="mt-1 text-[10px] text-slate-500">
            Green = permitted, red = no-go (still enterable, to see the reaction), grey = outside
            the modelled volume. Hover a node for the reason.
          </p>
        </div>
      </div>
    </div>
  )
}
