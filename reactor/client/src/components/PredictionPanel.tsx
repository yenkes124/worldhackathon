import { ArrowRight, Brain, CheckCircle2, XCircle } from 'lucide-react'
import { fmtVec } from '../reactor/types'
import { useCellMeta, useMirror } from '../state/store'
import { Panel } from './Panel'

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-2.5 py-2">
    <p className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</p>
    <p className="mt-0.5 font-mono text-[12px] text-slate-100">{value}</p>
  </div>
)

export const PredictionPanel = () => {
  const sim = useMirror((s) => s.sim)
  const metaOf = useCellMeta()
  if (!sim) return null
  const { current, prediction } = sim

  return (
    <Panel title="World-model prediction" icon={Brain}>
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
          <p className="text-[10px] tracking-wide text-slate-500 uppercase">Current cell</p>
          <p className="mt-1 font-mono text-[15px] text-slate-100">{fmtVec(current.position)}</p>
          <p className="mt-1 text-[11.5px] font-medium" style={{ color: current.color }}>
            {current.type}
          </p>
          <p className="text-[10.5px] text-slate-500">{current.describe}</p>
        </div>

        <ArrowRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />

        <div className="flex-1 rounded-xl border border-slate-700/50 bg-slate-900/40 p-3">
          <p className="text-[10px] tracking-wide text-slate-500 uppercase">Predicted next</p>
          {prediction ? (
            <>
              <p className="mt-1 font-mono text-[15px] text-slate-100">{fmtVec(prediction.to)}</p>
              <p
                className="mt-1 text-[11.5px] font-medium"
                style={{ color: metaOf(prediction.predicted_type)?.color }}
              >
                {prediction.predicted_type}
              </p>
              <p className="text-[10.5px] text-slate-500">
                {prediction.action.label} ({prediction.action.hint})
              </p>
            </>
          ) : (
            <p className="mt-2 text-[12px] text-slate-400">
              Trajectory complete — the probe is at the conceptual target.
            </p>
          )}
        </div>
      </div>

      {prediction && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Action" value={prediction.action.id} />
            <Metric label="Risk" value={prediction.risk.toFixed(2)} />
            <Metric label="Reward" value={prediction.reward.toFixed(2)} />
          </div>
          <p
            className={`mt-2.5 flex items-start gap-2 rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed ${
              prediction.allowed
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
                : 'border-rose-400/30 bg-rose-500/10 text-rose-100'
            }`}
          >
            {prediction.allowed ? (
              <CheckCircle2 className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <XCircle className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            {prediction.rationale}
          </p>
        </>
      )}
    </Panel>
  )
}
