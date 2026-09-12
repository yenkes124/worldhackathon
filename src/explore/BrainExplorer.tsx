import { HappyOysterProvider, HappyOysterVideo } from '@reactor-models/happy-oyster/react'
import { ReactorProvider, ReactorView } from '@reactor-team/js-sdk'
import { Loader2, Pause, Play, Power, Sparkles } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useExplorer, type ExplorerPhase, type WorldEngine } from './explorerStore'
import { FALLBACK_WORLD_MODEL, useOysterSession } from './useOysterSession'
import { WORLD_MODEL, useWorldSession } from './useWorldSession'

// A session-scoped token only authorises the sessions *it* created, and the
// SDK calls the resolver for every request (uploads, ICE refresh, …), so the
// token must be cached and re-minted only near expiry.
const TOKEN_REFRESH_SKEW_MS = 60_000
let cachedToken: { jwt: string; expiresAtMs: number } | null = null
let inflightToken: Promise<string> | null = null

const mintJwt = async (): Promise<string> => {
  const res = await fetch('/api/token', { method: 'POST' })
  const body = (await res.json()) as {
    jwt?: string
    expires_at?: number
    detail?: unknown
    error?: string
  }
  if (!res.ok || !body.jwt) {
    throw new Error(
      typeof body.detail === 'string' ? body.detail : body.error ?? `token exchange failed (${res.status})`,
    )
  }
  const expiresAtMs = body.expires_at ? body.expires_at * 1000 : Date.now() + 55 * 60_000
  cachedToken = { jwt: body.jwt, expiresAtMs }
  return body.jwt
}

const fetchJwt = (): Promise<string> => {
  if (cachedToken && Date.now() < cachedToken.expiresAtMs - TOKEN_REFRESH_SKEW_MS) {
    return Promise.resolve(cachedToken.jwt)
  }
  inflightToken ??= mintJwt().finally(() => {
    inflightToken = null
  })
  return inflightToken
}

const KEYS: [string, string][] = [
  ['W / S', 'forward / back'],
  ['A / D', 'strafe'],
  ['← / →', 'look'],
  ['↑ / ↓', 'tilt'],
  ['Q / E', 'up / down a layer'],
]

const ENGINES: { id: WorldEngine; label: string; model: string }[] = [
  { id: 'lingbot', label: 'LingBot World 2', model: WORLD_MODEL },
  { id: 'happyoyster', label: 'HappyOyster', model: FALLBACK_WORLD_MODEL },
]

interface Session {
  status: string
  phase: ExplorerPhase
  begin: () => Promise<void>
  end: () => Promise<void>
  pause: () => void
  resume: () => void
}

interface StageProps {
  session: Session
  modelName: string
  video: ReactNode
}

const Stage = ({ session, modelName, video }: StageProps) => {
  const { status, phase, begin, end, pause, resume } = session
  const error = useExplorer((s) => s.error)
  const chunk = useExplorer((s) => s.chunk)
  const lastAction = useExplorer((s) => s.lastAction)
  const engine = useExplorer((s) => s.engine)
  const fallbackReason = useExplorer((s) => s.fallbackReason)
  const setEngine = useExplorer((s) => s.setEngine)
  const live = phase === 'exploring' || phase === 'paused'

  return (
    <div className="relative h-full w-full bg-black">
      {video}

      {fallbackReason && (
        <div className="pointer-events-none absolute top-3 right-3 z-10 max-w-xs rounded-md border border-amber-400/40 bg-slate-950/80 px-2.5 py-1.5 text-[10.5px] text-amber-100">
          Fallback world model: <span className="font-mono">{modelName}</span> — {fallbackReason}.
        </div>
      )}

      {!live && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(3,5,12,0.82)] p-6">
          <div className="glass max-w-md rounded-2xl p-6 text-center">
            {phase === 'idle' || phase === 'error' ? (
              <>
                <Sparkles className="mx-auto h-6 w-6 text-sky-300" aria-hidden />
                <h2 className="mt-3 text-[15px] font-semibold text-slate-50">
                  Generate the brain world
                </h2>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
                  Reactor’s hosted world model (<span className="font-mono">{modelName}</span>)
                  turns a stylised seed image into a navigable, streamed 3D scene. It is
                  imaginative scenery — not anatomy. Your movement is tracked on the
                  4×4×4 symbolic grid, which decides how the synthetic body reacts.
                </p>
                {phase === 'error' && (
                  <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-left text-[11.5px] text-rose-100">
                    {error}
                  </p>
                )}
                <div className="mt-4 flex justify-center gap-1 rounded-lg border border-slate-700/60 bg-slate-950/60 p-1">
                  {ENGINES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setEngine(option.id)}
                      className={`flex-1 rounded-md px-2 py-1 text-[11px] transition ${
                        engine === option.id
                          ? 'bg-sky-500/20 text-sky-100'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void begin()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/90 px-4 py-2.5 text-[13px] font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  <Play className="h-4 w-4" aria-hidden />
                  {phase === 'error' ? 'Try again' : 'Start a hosted session'}
                </button>
                <p className="mt-3 text-[10.5px] text-slate-500">
                  Uses your Reactor account’s usage-billed session time while streaming.
                </p>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-300" aria-hidden />
                <p className="mt-3 text-[13px] text-slate-200">
                  {phase === 'connecting'
                    ? (error ?? `Connecting to Reactor (${status})…`)
                    : engine === 'happyoyster'
                      ? 'Building the world from the seed image and region prompt (can take a minute)…'
                      : 'Seeding the world: image, region prompt, seed 20240917…'}
                </p>
                {phase === 'connecting' && error && (
                  <button
                    type="button"
                    onClick={() => void end()}
                    className="mt-4 rounded-lg border border-slate-700/60 px-3 py-1.5 text-[11px] text-slate-300 transition hover:border-sky-400/40"
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {live && (
        <>
          <div className="pointer-events-none absolute top-3 left-4 flex flex-wrap gap-1.5">
            {KEYS.map(([k, what]) => (
              <span
                key={k}
                className="rounded-md border border-slate-700/60 bg-slate-950/70 px-2 py-1 text-[10.5px] text-slate-300"
              >
                <span className="font-mono text-slate-100">{k}</span> {what}
              </span>
            ))}
          </div>
          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            <span className="rounded-md border border-slate-700/60 bg-slate-950/70 px-2 py-1 font-mono text-[10.5px] text-slate-400">
              chunk {chunk} · {lastAction}
            </span>
            <button
              type="button"
              onClick={phase === 'paused' ? resume : pause}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-950/80 px-2.5 py-1.5 text-[11px] text-slate-200 transition hover:border-sky-400/40"
            >
              {phase === 'paused' ? (
                <Play className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Pause className="h-3.5 w-3.5" aria-hidden />
              )}
              {phase === 'paused' ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={() => void end()}
              className="flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-[11px] text-rose-100 transition hover:bg-rose-500/25"
            >
              <Power className="h-3.5 w-3.5" aria-hidden />
              End session
            </button>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-4 max-w-sm rounded-md border border-amber-400/30 bg-slate-950/70 px-2.5 py-1.5 text-[10.5px] text-amber-100/90">
            Generated scenery is fictional and non-repeatable in detail. The body response
            comes from the symbolic grid, not from what you see.
          </div>
        </>
      )}
    </div>
  )
}

const LingbotStage = () => {
  const session = useWorldSession()
  return (
    <Stage
      session={session}
      modelName={WORLD_MODEL}
      video={<ReactorView track="main_video" className="h-full w-full" videoObjectFit="cover" />}
    />
  )
}

const OysterStage = () => {
  const session = useOysterSession(fetchJwt)
  const fallbackReason = useExplorer((s) => s.fallbackReason)
  const autoStarted = useRef(false)
  // Mounted because the primary model was saturated mid-start: carry on
  // without asking the user to click again.
  useEffect(() => {
    if (!fallbackReason || autoStarted.current) return
    autoStarted.current = true
    void session.begin()
  }, [fallbackReason, session])
  return (
    <Stage
      session={session}
      modelName={FALLBACK_WORLD_MODEL}
      video={
        <HappyOysterVideo autoPlay muted playsInline className="h-full w-full object-cover" />
      }
    />
  )
}

export const BrainExplorer = () => {
  const engine = useExplorer((s) => s.engine)
  return engine === 'happyoyster' ? (
    <HappyOysterProvider key="happyoyster" mode="adventure" jwt={fetchJwt}>
      <OysterStage />
    </HappyOysterProvider>
  ) : (
    <ReactorProvider key="lingbot" modelName={WORLD_MODEL} jwtToken={fetchJwt}>
      <LingbotStage />
    </ReactorProvider>
  )
}
