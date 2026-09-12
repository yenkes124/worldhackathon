import { Activity } from 'lucide-react'
import type { LearnerResult } from '../../sim/types'
import { selectMetrics, useSimulation } from '../../state/simulationStore'
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
        tone === 'good'
          ? 'text-emerald-300'
          : tone === 'bad'
            ? 'text-rose-300'
            : 'text-slate-100'
      }`}
    >
      {value}
    </p>
  </div>
)

export const MetricsPanel = () => {
  const plan = useSimulation((state) => state.plan)
  const mode = useSimulation((state) => state.mode)
  const metrics = useSimulation(selectMetrics)
  const learner = plan as LearnerResult

  return (
    <Panel title="Trajectory metrics" icon={Activity}>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Steps" value={String(metrics.steps)} />
        <Stat label="Total risk" value={metrics.totalRisk.toFixed(2)} />
        <Stat label="Peak risk" value={metrics.peakRisk.toFixed(2)} />
        <Stat label="Total reward" value={metrics.totalReward.toFixed(2)} />
        <Stat
          label="No-go hits"
          value={String(metrics.violations.length)}
          tone={metrics.violations.length === 0 ? 'good' : 'bad'}
        />
        <Stat
          label="Target"
          value={metrics.reachesTarget ? 'reached' : 'unreached'}
          tone={metrics.reachesTarget ? 'good' : 'bad'}
        />
      </div>
      <p className="mt-2.5 text-[11px] text-slate-500">
        {mode === 'astar'
          ? `A* expanded ${plan.expanded} cells under hard no-go constraints.`
          : `Learner ran ${learner.episodes ?? 0} seeded episodes and kept the best safe trajectory.`}
      </p>
    </Panel>
  )
}
