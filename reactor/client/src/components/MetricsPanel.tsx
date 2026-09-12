import { Activity } from 'lucide-react'
import { useMirror } from '../state/store'
import { Panel } from './Panel'

const Stat = ({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'good' | 'bad'
}) => (
  <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-2.5 py-2">
    <p className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</p>
    <p
      className={`mt-0.5 font-mono text-[13px] ${
        tone === 'good' ? 'text-emerald-300' : tone === 'bad' ? 'text-rose-300' : 'text-slate-100'
      }`}
    >
      {value}
    </p>
  </div>
)

export const MetricsPanel = () => {
  const sim = useMirror((s) => s.sim)
  if (!sim) return null
  const { plan, mode, stepIndex, metrics } = sim

  return (
    <Panel title="Planned trajectory metrics" icon={Activity}>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Steps" value={`${stepIndex} / ${metrics.steps}`} />
        <Stat label="Total risk" value={metrics.total_risk.toFixed(2)} />
        <Stat label="Peak risk" value={metrics.peak_risk.toFixed(2)} />
        <Stat label="Total reward" value={metrics.total_reward.toFixed(2)} />
        <Stat
          label="No-go hits"
          value={String(metrics.violations.length)}
          tone={metrics.violations.length === 0 ? 'good' : 'bad'}
        />
        <Stat
          label="Plan hits target"
          value={metrics.reaches_target ? 'yes' : 'no'}
          tone={metrics.reaches_target ? 'good' : 'bad'}
        />
      </div>
      <p className="mt-2 text-[10.5px] text-slate-500">
        Risk, reward and target figures describe the whole planned route; steps show how far the
        probe has travelled along it.
      </p>
      <p className="mt-2.5 text-[11px] text-slate-500">
        {mode === 'astar'
          ? `A* expanded ${plan.expanded} cells under hard no-go constraints.`
          : `Learner ran ${plan.episodes} seeded episodes and kept the best safe trajectory.`}
      </p>
    </Panel>
  )
}
