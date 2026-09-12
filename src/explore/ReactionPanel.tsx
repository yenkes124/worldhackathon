import { Activity, Compass, Route } from 'lucide-react'
import { Panel } from '../components/ui/Panel'
import { CELL_META } from '../sim/cellMeta'
import { describeCoord } from '../sim/grid'
import type { ReactionSeverity } from '../sim/reactions'
import { distanceToTarget, useExplorer } from './explorerStore'
import { headingLabel } from './navigation'

const SEVERITY: Record<ReactionSeverity, { label: string; className: string }> = {
  none: { label: 'No response', className: 'border-slate-600/50 bg-slate-800/40 text-slate-200' },
  mild: { label: 'Mild', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' },
  severe: { label: 'Severe · no-go', className: 'border-amber-400/40 bg-amber-400/10 text-amber-100' },
  critical: { label: 'Critical · no-go', className: 'border-rose-400/40 bg-rose-500/10 text-rose-100' },
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-2.5 py-2">
    <p className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</p>
    <p className="mt-0.5 font-mono text-[12px] text-slate-100">{value}</p>
  </div>
)

export const ReactionPanel = () => {
  const cell = useExplorer((s) => s.cell)
  const cellType = useExplorer((s) => s.cellType)
  const reaction = useExplorer((s) => s.reaction)
  const heading = useExplorer((s) => s.nav.heading)
  const meta = CELL_META[cellType]
  const severity = SEVERITY[reaction.severity]

  return (
    <Panel title="Synthetic body response" icon={Activity}>
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] tracking-wide text-slate-500 uppercase">You are in</p>
            <p className="mt-1 font-mono text-[15px] text-slate-100">[{cell.join(', ')}]</p>
            <p className="mt-1 text-[11.5px] font-medium" style={{ color: meta.color }}>
              {meta.name}
            </p>
            <p className="text-[10.5px] text-slate-500">
              {describeCoord(cell)} · facing {headingLabel(heading)}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold ${severity.className}`}
          >
            {severity.label}
          </span>
        </div>
      </div>

      <div
        className={`mt-3 rounded-xl border px-3.5 py-3 ${severity.className}`}
        aria-live="polite"
      >
        <p className="text-[13.5px] font-semibold">{reaction.headline}</p>
        <p className="mt-1 text-[12px] leading-relaxed opacity-90">{reaction.body}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Cell risk" value={meta.risk.toFixed(2)} />
        <Metric label="Cell reward" value={meta.reward.toFixed(2)} />
        <Metric label="To target" value={`${distanceToTarget(cell)} steps`} />
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">
        Reactions are invented storytelling derived from the cell’s symbolic
        risk / reward / no-go values — not physiology.
      </p>
    </Panel>
  )
}

export const PlannerHintPanel = () => {
  const suggestedAction = useExplorer((s) => s.suggestedAction)
  const suggestion = useExplorer((s) => s.suggestion)
  const noGoEntries = useExplorer((s) => s.noGoEntries)
  const accumulatedRisk = useExplorer((s) => s.accumulatedRisk)
  const visited = useExplorer((s) => s.visited)
  const reachedTarget = useExplorer((s) => s.reachedTarget)

  return (
    <Panel title="Planner guidance" icon={Route}>
      <div className="flex items-start gap-2.5 rounded-xl border border-sky-400/25 bg-sky-400/10 px-3 py-2.5 text-sky-100">
        <Compass className="mt-[2px] h-4 w-4 shrink-0 text-sky-300" aria-hidden />
        <div>
          <p className="text-[10px] tracking-wide text-sky-300/80 uppercase">A* suggests</p>
          <p className="mt-0.5 text-[12.5px] font-medium">{suggestedAction}</p>
          {suggestion.found && suggestion.path.length > 1 && (
            <p className="mt-1 font-mono text-[10.5px] text-sky-200/70">
              {suggestion.path.map((p) => `[${p.join(',')}]`).join(' → ')}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric label="Cells visited" value={String(visited.length)} />
        <Metric label="No-go entries" value={String(noGoEntries)} />
        <Metric label="Risk so far" value={accumulatedRisk.toFixed(2)} />
      </div>
      <p className="mt-2.5 text-[11.5px] text-slate-400">
        {reachedTarget
          ? 'You have reached the conceptual target at least once — the synthetic tremor stopped.'
          : 'Reach [1, 1, 1] (VIM_TARGET) without entering no-go tissue.'}
      </p>
    </Panel>
  )
}
