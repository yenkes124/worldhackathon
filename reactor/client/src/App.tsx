import { ReactorProvider } from '@reactor-team/js-sdk'
import { Brain, Code2 } from 'lucide-react'
import { ConnectionBadge } from './components/ConnectionBadge'
import { ControlPanel } from './components/ControlPanel'
import { IntroOverlay } from './components/IntroOverlay'
import { LegendPanel } from './components/LegendPanel'
import { MetricsPanel } from './components/MetricsPanel'
import { PredictionPanel } from './components/PredictionPanel'
import { SafetyBanner } from './components/SafetyBanner'
import { SceneView } from './components/SceneView'
import { useModelMirror } from './reactor/useCommands'
import { useMirror } from './state/store'

// VITE_REACTOR_LOCAL=true  -> talk straight to a Reactor Runtime container
//                             (`reactor run`, or the same image self-hosted at
//                             VITE_REACTOR_API_URL). No key involved.
// VITE_REACTOR_LOCAL=false -> Reactor cloud; JWT minted by POST /api/token.
const LOCAL = import.meta.env.VITE_REACTOR_LOCAL !== 'false'
const MODEL = import.meta.env.VITE_REACTOR_MODEL ?? 'neurogrid'
const API_URL = import.meta.env.VITE_REACTOR_API_URL as string | undefined

const fetchToken = async (): Promise<string> => {
  const response = await fetch('/api/token', { method: 'POST' })
  if (!response.ok) throw new Error(`token route failed: ${response.status}`)
  const { jwt } = (await response.json()) as { jwt: string }
  return jwt
}

const Shell = () => {
  useModelMirror()
  const hasStarted = useMirror((s) => s.sim?.hasStarted ?? false)
  const ready = useMirror((s) => s.sim !== null && s.scenario !== null)

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-navy-950">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800/60 px-5 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-400/15 text-sky-300">
          <Brain className="h-4 w-4" aria-hidden />
        </span>
        <div className="mr-auto">
          <h1 className="text-[15px] leading-tight font-semibold tracking-tight text-slate-50">
            NeuroGrid
          </h1>
          <p className="text-[11px] text-slate-500">
            Synthetic world-model trajectory simulation · Reactor Runtime port
          </p>
        </div>
        <ConnectionBadge target={LOCAL ? `${MODEL} (local runtime)` : MODEL} />
        <a
          href="https://github.com/yenkes124/worldhackathon"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:border-sky-400/40 hover:text-slate-200"
        >
          <Code2 className="h-3.5 w-3.5" aria-hidden />
          Source
        </a>
      </header>

      <div className="shrink-0 px-5 pt-3">
        <SafetyBanner />
      </div>

      <main className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
        <div className="glass relative min-h-[420px] overflow-hidden rounded-2xl lg:min-h-0">
          <SceneView />
          <div className="pointer-events-none absolute bottom-3 left-4 text-[10.5px] text-slate-500">
            Drag to orbit · scroll to zoom · click a cyan ENT voxel to change entry
          </div>
        </div>

        <aside className="panel-scroll flex flex-col gap-4 pr-1 lg:min-h-0 lg:overflow-y-auto">
          <PredictionPanel />
          <ControlPanel />
          <MetricsPanel />
          <LegendPanel />
        </aside>
      </main>

      {!hasStarted && <IntroOverlay ready={ready} />}
    </div>
  )
}

// Stable references: ReactorProvider rebuilds the connection when these change.
const CONNECT_OPTIONS = { autoConnect: true }
const JWT_SOURCE = LOCAL ? undefined : fetchToken

const App = () => {
  return (
    <ReactorProvider
      modelName={MODEL}
      local={LOCAL}
      apiUrl={API_URL}
      jwtToken={JWT_SOURCE}
      connectOptions={CONNECT_OPTIONS}
    >
      <Shell />
    </ReactorProvider>
  )
}

export default App
