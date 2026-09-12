import { useReactor } from '@reactor-team/js-sdk'

const TONE: Record<string, string> = {
  ready: 'bg-emerald-400',
  connecting: 'bg-amber-400 animate-pulse',
  waiting: 'bg-amber-400 animate-pulse',
  disconnected: 'bg-rose-400',
}

export const ConnectionBadge = ({ target }: { target: string }) => {
  const status = useReactor((s) => s.status)
  const error = useReactor((s) => s.lastError)
  return (
    <div
      className="flex items-center gap-2 rounded-lg border border-slate-700/60 px-2.5 py-1.5 text-[11px] text-slate-400"
      title={error ? String(error.message) : undefined}
    >
      <span className={`h-2 w-2 rounded-full ${TONE[status] ?? 'bg-slate-500'}`} />
      <span className="font-mono">{target}</span>
      <span>· {status}</span>
    </div>
  )
}
