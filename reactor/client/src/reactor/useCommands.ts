import { useReactor, useReactorMessage } from '@reactor-team/js-sdk'
import { useCallback, useEffect } from 'react'
import { useMirror } from '../state/store'
import type { PlanningMode, Vec3 } from './types'

// Folds every model message *and* every command reply into the mirror store.
export const useModelMirror = () => {
  const apply = useMirror((s) => s.apply)
  const clear = useMirror((s) => s.clear)
  const status = useReactor((s) => s.status)
  const sendCommand = useReactor((s) => s.sendCommand)

  useReactorMessage((message) => apply(message.type, message.data))

  // The model pushes scenario/state on connect, but that can race the data
  // channel; pull them explicitly once the session is ready.
  useEffect(() => {
    if (status === 'disconnected') clear()
    if (status !== 'ready') return
    for (const command of ['get_scenario', 'get_state']) {
      sendCommand(command)
        .then((reply) => reply && apply(reply.type, reply.data))
        .catch((error) => console.warn(`[neurogrid] ${command} failed`, error))
    }
  }, [status, clear, sendCommand, apply])
}

export const useCommands = () => {
  const sendCommand = useReactor((s) => s.sendCommand)
  const apply = useMirror((s) => s.apply)

  const send = useCallback(
    async (command: string, data?: Record<string, unknown>) => {
      try {
        const reply = await sendCommand(command, data)
        if (reply) apply(reply.type, reply.data)
      } catch (error) {
        console.warn(`[neurogrid] ${command} failed`, error)
      }
    },
    [sendCommand, apply],
  )

  return {
    start: () => send('start'),
    run: () => send('run'),
    pause: () => send('pause'),
    step: () => send('step'),
    reset: () => send('reset'),
    toggleFailed: () => send('toggle_failed'),
    setEntry: (position: Vec3) => send('set_entry', { position }),
    setMode: (mode: PlanningMode) => send('set_mode', { mode }),
    orbit: (yaw: number, pitch: number, zoom = 1) => send('orbit', { yaw, pitch, zoom }),
    resetCamera: () => send('reset_camera'),
    hover: (u: number, v: number) => send('hover', { u, v }),
    click: (u: number, v: number) => send('click', { u, v }),
  }
}
