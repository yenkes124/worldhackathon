import { Boxes, Brain, Code2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BrainScene } from './components/scene/BrainScene'
import { ControlPanel } from './components/ui/ControlPanel'
import { IntroOverlay } from './components/ui/IntroOverlay'
import { LegendPanel } from './components/ui/LegendPanel'
import { MetricsPanel } from './components/ui/MetricsPanel'
import { PredictionPanel } from './components/ui/PredictionPanel'
import { SafetyBanner } from './components/ui/SafetyBanner'
import { BrainExplorer } from './explore/BrainExplorer'
import { MiniMap } from './explore/MiniMap'
import { PlannerHintPanel, ReactionPanel } from './explore/ReactionPanel'
import { useSimulation } from './state/simulationStore'

const STEP_INTERVAL_MS = 900

type View = 'explore' | 'grid'

const VIEWS: { id: View; label: string; icon: typeof Boxes }[] = [
  { id: 'explore', label: 'Generated brain', icon: Sparkles },
  { id: 'grid', label: 'Voxel grid', icon: Boxes },
]

const App = () => {
  const hasStarted = useSimulation((state) => state.hasStarted)
  const isRunning = useSimulation((state) => state.isRunning)
  const tick = useSimulation((state) => state.tick)
  const [view, setView] = useState<View>('explore')

  useEffect(() => {
    if (!isRunning) return
    const id = window.setInterval(tick, STEP_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [isRunning, tick])

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
            Synthetic world-model trajectory simulation · hackathon proof of
            concept
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Visualisation"
          className="flex rounded-lg border border-slate-700/60 p-0.5"
        >
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition ${
                view === id
                  ? 'bg-sky-400/15 text-sky-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
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
        {view === 'explore' ? (
          <>
            <div className="glass relative min-h-[420px] overflow-hidden rounded-2xl lg:min-h-0">
              <BrainExplorer />
            </div>
            <aside className="panel-scroll flex flex-col gap-4 pr-1 lg:min-h-0 lg:overflow-y-auto">
              <ReactionPanel />
              <PlannerHintPanel />
              <MiniMap />
              <LegendPanel />
            </aside>
          </>
        ) : (
          <>
            <div className="glass relative min-h-[420px] overflow-hidden rounded-2xl lg:min-h-0">
              <BrainScene />
              <div className="pointer-events-none absolute bottom-3 left-4 text-[10.5px] text-slate-500">
                Drag to orbit · scroll to zoom · click a cyan ENT voxel to change
                entry
              </div>
            </div>
            <aside className="panel-scroll flex flex-col gap-4 pr-1 lg:min-h-0 lg:overflow-y-auto">
              <PredictionPanel />
              <ControlPanel />
              <MetricsPanel />
              <LegendPanel />
            </aside>
          </>
        )}
      </main>

      {!hasStarted && <IntroOverlay />}
    </div>
  )
}

export default App
