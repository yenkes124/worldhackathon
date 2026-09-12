import { create } from 'zustand'
import type {
  CameraState,
  HoverInfo,
  ScenarioInfo,
  SimulationState,
} from '../reactor/types'

// Mirror of the model-side state. The model is the source of truth; every
// message it sends (or replies with) is folded in here so panels re-render.
interface MirrorState {
  scenario: ScenarioInfo | null
  sim: SimulationState | null
  camera: CameraState | null
  hover: HoverInfo
  apply: (type: string, data: unknown) => void
  clear: () => void
}

export const useMirror = create<MirrorState>((set) => ({
  scenario: null,
  sim: null,
  camera: null,
  hover: { position: null, type: null },
  apply: (type, data) => {
    switch (type) {
      case 'scenario_info':
        set({ scenario: data as ScenarioInfo })
        break
      case 'simulation_state':
        set({ sim: (data as { state: SimulationState }).state })
        break
      case 'camera_state':
        set({ camera: data as CameraState })
        break
      case 'hover_info':
        set({ hover: data as HoverInfo })
        break
      default:
        break
    }
  },
  clear: () => set({ sim: null, camera: null, hover: { position: null, type: null } }),
}))

export const useCellMeta = () => {
  const legend = useMirror((s) => s.scenario?.legend)
  return (type: string) => legend?.find((m) => m.type === type)
}
