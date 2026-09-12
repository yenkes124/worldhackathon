import { Compass } from 'lucide-react'
import type { AppMode } from '../../state/simulationStore'
import { useSimulation } from '../../state/simulationStore'
import { Panel } from './Panel'

const MODES: { id: AppMode; label: string; hint: string }[] = [
  {
    id: 'guided',
    label: 'Guided Planner',
    hint: 'The agent already knows the whole synthetic environment and plans a full route up front.',
  },
  {
    id: 'explore',
    label: 'Explore and Learn',
    hint: 'The agent starts with an incomplete knowledge map and learns one simulated safety check at a time.',
  },
]

export const ModeSelector = () => {
  const mode = useSimulation((state) => state.mode)
  const setMode = useSimulation((state) => state.setMode)

  return (
    <Panel title="Mode" icon={Compass}>
      <div className="grid gap-2">
        {MODES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => setMode(option.id)}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              mode === option.id
                ? 'border-sky-400/60 bg-sky-400/10 text-sky-100'
                : 'border-slate-700/50 bg-slate-900/40 text-slate-300 hover:border-sky-400/30'
            }`}
          >
            <span className="block text-[12.5px] font-semibold">
              {option.label}
            </span>
            <span className="mt-0.5 block text-[10.5px] leading-snug text-slate-400">
              {option.hint}
            </span>
          </button>
        ))}
      </div>
    </Panel>
  )
}
