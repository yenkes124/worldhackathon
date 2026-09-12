import {
  Crosshair,
  Eye,
  Map as MapIcon,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { knowledgeKey, sameKnowledgeCell } from '../../sim/agentKnowledge'
import {
  selectExploreAccuracy,
  selectNextExploreAction,
  useSimulation,
} from '../../state/simulationStore'
import { Panel } from './Panel'

const buttonBase =
  'flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40'

const LEGEND: { label: string; color: string }[] = [
  { label: 'Unknown', color: '#475569' },
  { label: 'Confirmed safe', color: '#34d399' },
  { label: 'Confirmed restricted', color: '#ff4d6a' },
  { label: 'Known entry', color: '#22d3ee' },
  { label: 'Known target', color: '#34ff9b' },
]

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
      className={`mt-0.5 font-mono text-[12px] ${
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

export const ExplorePanel = () => {
  const scenario = useSimulation((state) => state.scenario)
  const exploreEntry = useSimulation((state) => state.exploreEntry)
  const started = useSimulation((state) => state.exploreStarted)
  const current = useSimulation((state) => state.exploreCurrentPosition)
  const target = useSimulation((state) => state.exploreTargetPosition)
  const prediction = useSimulation((state) => state.lastExplorePrediction)
  const observation = useSimulation((state) => state.lastExploreObservation)
  const proposal = useSimulation((state) => state.exploreRouteProposal)
  const metrics = useSimulation((state) => state.exploreMetrics)
  const decisionLog = useSimulation((state) => state.exploreDecisionLog)
  const accuracy = useSimulation(selectExploreAccuracy)
  const nextAction = useSimulation(selectNextExploreAction)
  const setExploreEntry = useSimulation((state) => state.setExploreEntry)
  const startExploreSession = useSimulation((state) => state.startExploreSession)
  const resetExploreSession = useSimulation((state) => state.resetExploreSession)
  const predictExploreAction = useSimulation(
    (state) => state.predictExploreAction,
  )
  const validateExploreAction = useSimulation(
    (state) => state.validateExploreAction,
  )
  const replanExploreRoute = useSimulation((state) => state.replanExploreRoute)

  const atTarget = sameKnowledgeCell(current, target)
  const canAct = started && !atTarget && Boolean(nextAction ?? prediction)

  return (
    <div className="space-y-4">
      <Panel title="Explore and Learn" icon={Sparkles}>
        <p className="text-[12px] leading-relaxed text-slate-300">
          Explore and Learn begins with incomplete knowledge. The agent predicts
          a result, the synthetic environment checks it, and the knowledge map
          updates.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Current position" value={`[${current.join(', ')}]`} />
          <Stat
            label="Next predicted position"
            value={
              prediction ? `[${prediction.predictedPosition.join(', ')}]` : '—'
            }
          />
          <Stat
            label="Prediction confidence"
            value={prediction ? `${prediction.confidence}%` : '—'}
          />
          <Stat
            label="Predicted risk"
            value={prediction ? prediction.predictedRisk : '—'}
            tone={prediction?.predictedRisk === 'high' ? 'bad' : 'default'}
          />
        </div>

        <p
          className={`mt-2.5 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed ${
            observation
              ? observation.allowedToAdvance
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                : 'border-rose-400/30 bg-rose-500/10 text-rose-100'
              : 'border-slate-700/50 bg-slate-900/40 text-slate-400'
          }`}
        >
          {observation
            ? observation.explanation
            : 'No simulated safety check has run yet.'}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat
            label="Safe cells confirmed"
            value={String(metrics.safeCellsConfirmed)}
            tone="good"
          />
          <Stat
            label="Restricted discovered"
            value={String(metrics.restrictedCellsDiscovered)}
            tone={metrics.restrictedCellsDiscovered > 0 ? 'bad' : 'default'}
          />
          <Stat
            label="Prediction accuracy"
            value={accuracy === null ? '—' : `${accuracy}%`}
          />
        </div>
        <p className="mt-2 text-[10.5px] text-slate-500">
          Replans completed: {metrics.replansCompleted} · counterfactual route:{' '}
          {proposal?.found
            ? `${proposal.route.length - 1} step(s), ${proposal.unknownCells} unknown`
            : (proposal?.explanation ?? 'not proposed yet')}
        </p>
      </Panel>

      <Panel title="Explore controls" icon={Eye}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => startExploreSession(exploreEntry)}
            className={`${buttonBase} border-cyan-400/40 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/20`}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Start Explore
          </button>
          <button
            type="button"
            onClick={() => predictExploreAction()}
            disabled={!canAct}
            className={`${buttonBase} border-sky-400/40 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20`}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden /> Predict Next Step
          </button>
          <button
            type="button"
            onClick={() => validateExploreAction()}
            disabled={!canAct}
            className={`${buttonBase} border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Run Simulated
            Safety Check
          </button>
          <button
            type="button"
            onClick={() => replanExploreRoute()}
            disabled={!started}
            className={`${buttonBase} border-purple-400/40 bg-purple-400/10 text-purple-100 hover:bg-purple-400/20`}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Replan
          </button>
          <button
            type="button"
            onClick={resetExploreSession}
            className={`${buttonBase} col-span-2 border-slate-600/60 bg-slate-800/50 text-slate-200 hover:bg-slate-700/50`}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset Explore
          </button>
        </div>
        <p className="mt-2.5 text-[11px] text-slate-500">
          {atTarget
            ? 'The probe has reached the fixed target of the synthetic environment.'
            : started
              ? `Proposed next action: ${nextAction ? `${nextAction.label} (${nextAction.hint})` : 'none — replan to propose a route'}.`
              : 'Pick an entry and start an Explore session.'}
        </p>
      </Panel>

      <Panel title="Explore entry point" icon={Crosshair}>
        <div className="space-y-2">
          {scenario.entries.map((candidate) => {
            const selected = sameKnowledgeCell(candidate, exploreEntry)
            return (
              <button
                key={knowledgeKey(candidate)}
                type="button"
                onClick={() => setExploreEntry(candidate)}
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
                  {selected ? 'selected' : 'known entry'}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Selecting an entry resets the knowledge map for a fresh Explore
          session. The target stays fixed at [{target.join(', ')}].
        </p>
      </Panel>

      <Panel title="Knowledge map" icon={MapIcon}>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {LEGEND.map((item) => (
            <li key={item.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-[10.5px] text-slate-300">
                {item.label}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10.5px] leading-relaxed text-slate-500">
          Unknown cells carry no label and no restriction flag until a simulated
          safety check reveals them.
        </p>
      </Panel>

      <Panel title="Decision log" icon={RefreshCw}>
        {decisionLog.length === 0 ? (
          <p className="text-[11.5px] text-slate-500">
            Nothing logged yet for this Explore session.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {decisionLog.slice(-6).map((item, index) => (
              <li
                key={`${decisionLog.length - Math.min(decisionLog.length, 6) + index}-${item}`}
                className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-300"
              >
                {item}
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  )
}
