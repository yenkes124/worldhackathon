import {
  AlertTriangle,
  Crosshair,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Target,
} from 'lucide-react'
import { describeCoord, key, sameCell } from '../../sim/grid'
import type { PlanningMode } from '../../state/simulationStore'
import { useSimulation } from '../../state/simulationStore'
import { Panel } from './Panel'

const MODES: { id: PlanningMode; label: string; hint: string }[] = [
  { id: 'astar', label: 'A* Planner', hint: 'Risk-weighted search with hard constraints' },
  { id: 'learner', label: 'Learner Demo', hint: 'Seeded rollouts scored by the world model' },
]

const buttonBase =
  'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40'

export const ControlPanel = () => {
  const scenario = useSimulation((state) => state.scenario)
  const entry = useSimulation((state) => state.entry)
  const mode = useSimulation((state) => state.mode)
  const plan = useSimulation((state) => state.plan)
  const stepIndex = useSimulation((state) => state.stepIndex)
  const isRunning = useSimulation((state) => state.isRunning)
  const showFailed = useSimulation((state) => state.showFailed)
  const failureReason = useSimulation((state) => state.failureReason)
  const setEntry = useSimulation((state) => state.setEntry)
  const setMode = useSimulation((state) => state.setMode)
  const run = useSimulation((state) => state.run)
  const pause = useSimulation((state) => state.pause)
  const reset = useSimulation((state) => state.reset)
  const step = useSimulation((state) => state.step)
  const toggleFailed = useSimulation((state) => state.toggleFailed)

  const atEnd = stepIndex >= plan.path.length - 1

  return (
    <div className="space-y-4">
      <Panel title="Scenario" icon={Target}>
        <p className="text-[13px] font-semibold text-slate-100">{scenario.title}</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">
          {scenario.context}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-2.5 py-2">
            <dt className="text-slate-500">Target voxel</dt>
            <dd className="mt-0.5 font-mono text-[12px] text-emerald-300">
              [{scenario.target.join(', ')}]
            </dd>
          </div>
          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-2.5 py-2">
            <dt className="text-slate-500">Highlighted context</dt>
            <dd className="mt-0.5 text-[12px] text-amber-300">Left MOT_HAND</dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Simulation controls" icon={Play}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={run}
            disabled={!plan.found || isRunning}
            className={`${buttonBase} border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`}
          >
            <Play className="h-3.5 w-3.5" aria-hidden /> Run
          </button>
          <button
            type="button"
            onClick={pause}
            disabled={!isRunning}
            className={`${buttonBase} border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/50`}
          >
            <Pause className="h-3.5 w-3.5" aria-hidden /> Pause
          </button>
          <button
            type="button"
            onClick={step}
            disabled={!plan.found || atEnd}
            className={`${buttonBase} border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20`}
          >
            <SkipForward className="h-3.5 w-3.5" aria-hidden /> Step
          </button>
          <button
            type="button"
            onClick={reset}
            className={`${buttonBase} border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/50`}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
          </button>
        </div>
        <p className="mt-2.5 text-[11px] text-slate-500">
          Step {Math.min(stepIndex, Math.max(plan.path.length - 1, 0))} of{' '}
          {Math.max(plan.path.length - 1, 0)}
        </p>
      </Panel>

      <Panel title="Entry point" icon={Crosshair}>
        <div className="space-y-2">
          {scenario.entries.map((candidate) => {
            const selected = sameCell(candidate, entry)
            return (
              <button
                key={key(candidate)}
                type="button"
                onClick={() => setEntry(candidate)}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                  selected
                    ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-100'
                    : 'border-slate-700/50 bg-slate-900/40 text-slate-300 hover:border-cyan-400/30'
                }`}
              >
                <span className="font-mono text-[12px]">
                  [{candidate.join(', ')}]
                </span>
                <span className="text-[11px] text-slate-400">
                  {describeCoord(candidate)}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Entry corridors can also be clicked directly in the 3D scene.
        </p>
      </Panel>

      <Panel title="Planning mode" icon={Sparkles}>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                mode === option.id
                  ? 'border-purple-400/60 bg-purple-400/10 text-purple-100'
                  : 'border-slate-700/50 bg-slate-900/40 text-slate-300 hover:border-purple-400/30'
              }`}
            >
              <span className="block text-[12px] font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-[10.5px] leading-snug text-slate-400">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Failed candidate" icon={AlertTriangle}>
        <button
          type="button"
          role="switch"
          aria-checked={showFailed}
          onClick={toggleFailed}
          className="flex w-full items-center justify-between gap-3"
        >
          <span className="text-[12px] text-slate-300">
            Show unsafe direct route
          </span>
          <span
            className={`relative h-5 w-9 rounded-full transition ${
              showFailed ? 'bg-rose-500/70' : 'bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-slate-100 transition-all ${
                showFailed ? 'left-[18px]' : 'left-0.5'
              }`}
            />
          </span>
        </button>
        {showFailed && (
          <p className="mt-2.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-[11.5px] leading-relaxed text-rose-100">
            {failureReason}
          </p>
        )}
      </Panel>
    </div>
  )
}
