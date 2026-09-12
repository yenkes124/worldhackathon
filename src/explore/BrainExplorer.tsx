import { HappyOysterProvider, HappyOysterVideo } from '@reactor-models/happy-oyster/react'
import { ReactorProvider, ReactorView } from '@reactor-team/js-sdk'
import { ArrowLeft, Loader2, Pause, Play, Power } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { sameCell } from '../sim/grid'
import type { Action } from '../sim/types'
import { BrainEntryScene } from './BrainEntryScene'
import { useExplorer, type ExplorerPhase, type WorldEngine } from './explorerStore'
import { NodeNavigator } from './NodeNavigator'
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
      typeof body.detail === 'string'
        ? body.detail
        : (body.error ?? `token exchange failed (${res.status})`),
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
  stepTo: (action: Action) => Promise<void>
  resetPosition: () => Promise<void>
}

interface StageProps {
  session: Session
  modelName: string
  video: ReactNode
}

const startingText = (phase: ExplorerPhase, status: string, engine: WorldEngine, error?: string) =>
  phase === 'connecting'
    ? (error ?? `Connecting to Reactor (${status})…`)
    : engine === 'happyoyster'
      ? 'Building the world from the seed image and region prompt (can take a minute)…'
      : 'Seeding the world: image, region prompt, seed 20240917…'

const Stage = ({ session, modelName, video }: StageProps) => {
  const { status, phase, begin, end, pause, resume, stepTo, resetPosition } = session
  const error = useExplorer((s) => s.error)
  const chunk = useExplorer((s) => s.chunk)
  const lastAction = useExplorer((s) => s.lastAction)
  const engine = useExplorer((s) => s.engine)
  const fallbackReason = useExplorer((s) => s.fallbackReason)
  const setEngine = useExplorer((s) => s.setEngine)
  const entry = useExplorer((s) => s.entry)
  const setEntry = useExplorer((s) => s.setEntry)
  const dived = useExplorer((s) => s.dived)
  const setDived = useExplorer((s) => s.setDived)
  const [travelling, setTravelling] = useState(false)
  const live = phase === 'exploring' || phase === 'paused'
  const starting = phase === 'connecting' || phase === 'seeding'
  const interior = live && dived

  // The hosted world starts streaming as soon as the explorer mounts, so the
  // interior is already live (shown picture-in-picture) while an entry is chosen.
  // Deferred so the provider has settled (StrictMode's mount/unmount/mount
  // disposes and rebuilds its store) before the first connect.
  const autoStarted = useRef(false)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (autoStarted.current) return
      autoStarted.current = true
      void begin()
    }, 150)
    return () => window.clearTimeout(timer)
  }, [begin])

  const dive = () => {
    if (phase === 'idle' || phase === 'error') void begin()
    setDived(true)
  }

  const selectEntry = (cell: typeof entry) => {
    if (sameCell(cell, entry)) {
      dive()
      return
    }
    setEntry(cell)
  }

  const surface = () => setDived(false)

  const step = (action: Action) => {
    setTravelling(true)
    void stepTo(action).finally(() => setTravelling(false))
  }

  const resetToEntry = () => {
    setTravelling(true)
    void resetPosition().finally(() => setTravelling(false))
  }

  return (
    <div className="relative h-full w-full bg-black">
      {!interior && (
        <div className="absolute inset-0">
          <BrainEntryScene selected={entry} diving={dived && !live} onSelect={selectEntry} />
        </div>
      )}
      {/* One stream element; full-screen once dived, picture-in-picture before. */}
      <div
        className={`absolute overflow-hidden transition-all duration-700 ${
          interior
            ? 'inset-0 rounded-none'
            : live
              ? 'top-3 right-3 z-10 h-[9.5rem] w-[15rem] rounded-xl border border-sky-400/40 shadow-lg shadow-black/50'
              : 'pointer-events-none inset-0 opacity-0'
        }`}
      >
        {video}
        {live && !interior && (
          <button
            type="button"
            onClick={dive}
            className="absolute inset-0 flex items-end justify-between bg-gradient-to-t from-slate-950/80 to-transparent p-2 text-left text-[10.5px] text-sky-100"
          >
            <span>
              <span className="block font-semibold">Interior · live</span>
              <span className="block text-slate-300">{modelName}</span>
            </span>
            <span className="rounded bg-sky-400 px-1.5 py-0.5 font-semibold text-slate-950">
              Enter
            </span>
          </button>
        )}
      </div>

      {fallbackReason && (
        <div
          className={`pointer-events-none absolute right-3 z-10 max-w-xs ${live && !interior ? 'top-[10.5rem]' : 'top-3'} rounded-md border border-amber-400/40 bg-slate-950/80 px-2.5 py-1.5 text-[10.5px] text-amber-100`}
        >
          Fallback world model: <span className="font-mono">{modelName}</span> — {fallbackReason}.
        </div>
      )}

      {!interior && (
        <>
          <div className="pointer-events-none absolute top-3 left-4 max-w-sm">
            <h2 className="text-[15px] font-semibold text-slate-50">Choose an entry point</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Drag to orbit. Click a cyan spot on the superior surface, then dive in: Reactor’s
              hosted world model (<span className="font-mono">{modelName}</span>) is already
              rendering the interior (top right) and you will navigate it node by node on the 4×4×4
              symbolic grid. Regions are an invented mapping — not anatomy.
            </p>
          </div>
          <div className="absolute bottom-3 left-4 right-3 flex flex-wrap items-end justify-between gap-3">
            <div className="glass max-w-sm rounded-xl p-3">
              <p className="text-[10.5px] tracking-wide text-slate-500 uppercase">Selected entry</p>
              <p className="font-mono text-[13px] text-cyan-200">[{entry.join(', ')}]</p>
              {phase === 'error' && (
                <p className="mt-2 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-left text-[11px] text-rose-100">
                  {error}
                </p>
              )}
              {starting && (
                <p className="mt-2 flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-[11px] text-sky-100">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                  <span>{startingText(phase, status, engine, error)}</span>
                </p>
              )}
              <div className="mt-2 flex gap-1 rounded-lg border border-slate-700/60 bg-slate-950/60 p-1">
                {ENGINES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={starting}
                    onClick={() => {
                      if (option.id === engine) return
                      void end().then(() => setEngine(option.id))
                    }}
                    className={`flex-1 rounded-md px-2 py-1 text-[11px] transition disabled:opacity-50 ${
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
                onClick={dive}
                disabled={dived && starting}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500/90 px-4 py-2.5 text-[13px] font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
              >
                <Play className="h-4 w-4" aria-hidden />
                {phase === 'error'
                  ? 'Retry and dive in'
                  : live
                    ? 'Dive in at the selected entry'
                    : starting
                      ? 'Dive in when the world is ready'
                      : 'Start the world and dive in'}
              </button>
              <p className="mt-2 text-[10px] text-slate-500">
                Uses your Reactor account’s usage-billed session time while streaming.
              </p>
            </div>
          </div>
        </>
      )}

      {dived && starting && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center p-6">
          <div className="glass pointer-events-auto max-w-md rounded-2xl p-5 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-300" aria-hidden />
            <p className="mt-3 text-[13px] text-slate-200">
              {startingText(phase, status, engine, error)}
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
          </div>
        </div>
      )}

      {interior && (
        <>
          <div className="absolute bottom-3 left-4">
            <NodeNavigator
              onStep={step}
              onReset={resetToEntry}
              busy={travelling || phase !== 'exploring'}
            />
          </div>
          <div className="pointer-events-none absolute top-3 left-4 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={surface}
              className="pointer-events-auto flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-950/70 px-2 py-1 text-[10.5px] text-slate-200 transition hover:border-sky-400/40"
            >
              <ArrowLeft className="h-3 w-3" aria-hidden />
              Exterior
            </button>
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
              onClick={() => {
                setDived(false)
                void end()
              }}
              className="flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-[11px] text-rose-100 transition hover:bg-rose-500/25"
            >
              <Power className="h-3.5 w-3.5" aria-hidden />
              End session
            </button>
          </div>
          <div className="pointer-events-none absolute right-3 bottom-12 max-w-xs rounded-md border border-amber-400/30 bg-slate-950/70 px-2.5 py-1.5 text-right text-[10.5px] text-amber-100/90">
            Generated scenery is fictional and non-repeatable in detail. The body response comes
            from the symbolic grid, not from what you see.
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
  return (
    <Stage
      session={session}
      modelName={FALLBACK_WORLD_MODEL}
      video={<HappyOysterVideo autoPlay muted playsInline className="h-full w-full object-cover" />}
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
