import { ReactorView, useReactor } from '@reactor-team/js-sdk'
import { Loader2, RotateCcw } from 'lucide-react'
import { useRef, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react'
import { useCommands } from '../reactor/useCommands'
import { useMirror } from '../state/store'

const ORBIT_SENSITIVITY = 0.008
const HOVER_INTERVAL_MS = 80
const CLICK_SLOP_PX = 4

// The brain grid is rendered by the model and arrives as the `main_video`
// track, so pointer gestures are translated into `orbit` / `hover` / `click`
// commands instead of driving a client-side camera.
export const SceneView = () => {
  const status = useReactor((s) => s.status)
  const hover = useMirror((s) => s.hover)
  const { orbit, resetCamera, hover: sendHover, click } = useCommands()
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const lastHover = useRef(0)

  const uv = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      u: (event.clientX - rect.left) / rect.width,
      v: (event.clientY - rect.top) / rect.height,
    }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (d) {
      const dx = event.clientX - d.x
      const dy = event.clientY - d.y
      if (Math.abs(dx) + Math.abs(dy) > CLICK_SLOP_PX) d.moved = true
      if (d.moved) {
        d.x = event.clientX
        d.y = event.clientY
        void orbit(dx * ORBIT_SENSITIVITY, dy * ORBIT_SENSITIVITY)
      }
      return
    }
    const now = performance.now()
    if (now - lastHover.current < HOVER_INTERVAL_MS) return
    lastHover.current = now
    const { u, v } = uv(event)
    void sendHover(u, v)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (d && !d.moved) {
      const { u, v } = uv(event)
      void click(u, v)
    }
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    void orbit(0, 0, event.deltaY > 0 ? 0.9 : 1.1)
  }

  return (
    <div
      className="relative h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => void sendHover(-1, -1)}
      onWheel={onWheel}
    >
      <ReactorView
        track="main_video"
        className="h-full w-full"
        videoObjectFit="contain"
        style={{ background: '#05070f' }}
      />

      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-navy-950/70 text-[12px] text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {status === 'disconnected' ? 'Not connected to the model' : `Reactor: ${status}…`}
        </div>
      )}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          void resetCamera()
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-navy-900/70 px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:border-sky-400/40"
      >
        <RotateCcw className="h-3 w-3" aria-hidden /> View
      </button>

      {hover.position && (
        <div className="pointer-events-none absolute top-3 left-4 rounded-lg border border-slate-700/60 bg-navy-900/80 px-2.5 py-1.5 font-mono text-[11px] text-slate-200">
          [{hover.position.join(', ')}] · {hover.type}
        </div>
      )}
    </div>
  )
}
