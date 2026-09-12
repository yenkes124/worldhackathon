import { useReactor, useReactorMessage } from '@reactor-team/js-sdk'
import { useCallback, useEffect, useRef } from 'react'
import { scenePromptFor } from '../sim/reactions'
import { RIGHT_HAND_TREMOR } from '../sim/scenario'
import { useExplorer } from './explorerStore'
import type { Vertical } from './navigation'

export const WORLD_MODEL = 'reactor/lingbot-world-2'
const SEED_IMAGE_URL = '/brain-seed.jpg'

/** Camera-local translation bias for the pose layer (y is down). */
const POSE_UP = [0, 0, 0, 0, -1, 0]
const POSE_DOWN = [0, 0, 0, 0, 1, 0]

/** Reactor answers 429 "no available capacity" when every hosted GPU is busy. */
const CAPACITY_RETRY_DELAYS_MS = [5_000, 10_000, 15_000, 20_000, 30_000, 30_000]
const isCapacityError = (message: string) =>
  /\b429\b/.test(message) || /no available (capacity|servers)/i.test(message)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Payload = Record<string, unknown>
const asRecord = (value: unknown): Payload =>
  typeof value === 'object' && value !== null ? (value as Payload) : {}

/**
 * Drives one LingBot World 2 session: seeds it with the fictional brain image
 * + region prompt, starts generation, forwards keyboard navigation as
 * persistent movement commands, and feeds confirmed chunks into the symbolic
 * explorer store. Also hot-swaps the prompt when the explorer enters a new
 * grid region so the generated scenery loosely follows the symbolic map.
 */
export const useWorldSession = () => {
  const status = useReactor((s) => s.status)
  const lastError = useReactor((s) => s.lastError)
  const connect = useReactor((s) => s.connect)
  const disconnect = useReactor((s) => s.disconnect)
  const sendCommand = useReactor((s) => s.sendCommand)
  const uploadFile = useReactor((s) => s.uploadFile)

  const phase = useExplorer((s) => s.phase)
  const cellType = useExplorer((s) => s.cellType)
  const setPhase = useExplorer((s) => s.setPhase)
  const setVertical = useExplorer((s) => s.setVertical)
  const onChunk = useExplorer((s) => s.onChunk)
  const resetExplorer = useExplorer((s) => s.reset)

  const startedRef = useRef(false)
  const seedingRef = useRef(false)

  const send = useCallback(
    (command: string, data: Payload = {}) =>
      sendCommand(command, data).catch((error: unknown) =>
        setPhase('error', error instanceof Error ? error.message : String(error)),
      ),
    [sendCommand, setPhase],
  )

  const cancelledRef = useRef(false)
  const retryingRef = useRef(false)

  const begin = useCallback(async () => {
    resetExplorer()
    startedRef.current = false
    seedingRef.current = false
    cancelledRef.current = false
    setPhase('connecting')
    for (let attempt = 0; ; attempt += 1) {
      try {
        await connect()
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const delay = CAPACITY_RETRY_DELAYS_MS[attempt]
        if (!isCapacityError(message) || delay === undefined || cancelledRef.current) {
          setPhase('error', message)
          return
        }
        retryingRef.current = true
        setPhase(
          'connecting',
          `Reactor has no free capacity right now — retrying in ${delay / 1000}s (attempt ${attempt + 2} of ${CAPACITY_RETRY_DELAYS_MS.length + 1})`,
        )
        await sleep(delay)
        retryingRef.current = false
        if (cancelledRef.current) return
        setPhase('connecting')
      }
    }
  }, [connect, resetExplorer, setPhase])

  const end = useCallback(async () => {
    cancelledRef.current = true
    await disconnect().catch(() => undefined)
    setPhase('idle')
  }, [disconnect, setPhase])

  // Seed the world once the session is ready.
  useEffect(() => {
    if (status !== 'ready' || seedingRef.current) return
    seedingRef.current = true
    setPhase('seeding')
    const seed = async () => {
      const blob = await (await fetch(SEED_IMAGE_URL)).blob()
      const ref = await uploadFile(blob, { name: 'brain-seed.jpg' })
      await sendCommand('set_image', { image: ref })
      await sendCommand('set_prompt', { prompt: scenePromptFor(cellType) })
      await sendCommand('set_seed', { seed: RIGHT_HAND_TREMOR.seed })
      if (!startedRef.current) {
        startedRef.current = true
        await sendCommand('start')
      }
    }
    seed().catch((error: unknown) =>
      setPhase('error', error instanceof Error ? error.message : String(error)),
    )
    // cellType is read once at seeding time on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, uploadFile, sendCommand, setPhase])

  useEffect(() => {
    if (retryingRef.current) return
    if (status === 'disconnected' && phase !== 'idle' && phase !== 'error') {
      setPhase('idle')
    }
  }, [status, phase, setPhase])

  useEffect(() => {
    if (lastError && !retryingRef.current) setPhase('error', lastError.message)
  }, [lastError, setPhase])

  useReactorMessage((message) => {
    const data = asRecord(message.data)
    switch (message.type) {
      case 'generation_started':
      case 'generation_resumed':
        setPhase('exploring')
        break
      case 'generation_paused':
        setPhase('paused')
        break
      case 'chunk_complete':
        onChunk(
          Number(data.chunk_index ?? 0),
          typeof data.active_action === 'string' ? data.active_action : 'still',
        )
        break
      case 'command_error':
        setPhase('error', `${String(data.command)}: ${String(data.reason)}`)
        break
      default:
        break
    }
  })

  // Steer the generated scenery toward the region the explorer is in.
  const promptedType = useRef(cellType)
  useEffect(() => {
    if (phase !== 'exploring' || promptedType.current === cellType) return
    promptedType.current = cellType
    void send('set_prompt', { prompt: scenePromptFor(cellType) })
  }, [cellType, phase, send])

  const climb = useCallback(
    (vertical: Vertical) => {
      setVertical(vertical)
      void send('set_camera_pose', {
        camera_pose: vertical === 0 ? [] : vertical > 0 ? POSE_UP : POSE_DOWN,
      })
    },
    [send, setVertical],
  )

  // Keyboard → persistent LingBot inputs. Keys stay active until released.
  useEffect(() => {
    if (phase !== 'exploring') return
    const held = new Set<string>()
    const handle = (event: KeyboardEvent, down: boolean) => {
      if (event.repeat) return
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (down) held.add(k)
      else held.delete(k)
      switch (k) {
        case 'w':
        case 's':
          void send('set_move_longitudinal', {
            move_longitudinal: held.has('w') ? 'forward' : held.has('s') ? 'back' : 'idle',
          })
          break
        case 'a':
        case 'd':
          void send('set_move_lateral', {
            move_lateral: held.has('a')
              ? 'strafe_left'
              : held.has('d')
                ? 'strafe_right'
                : 'idle',
          })
          break
        case 'ArrowLeft':
        case 'ArrowRight':
          void send('set_look_horizontal', {
            look_horizontal: held.has('ArrowLeft')
              ? 'left'
              : held.has('ArrowRight')
                ? 'right'
                : 'idle',
          })
          break
        case 'ArrowUp':
        case 'ArrowDown':
          void send('set_look_vertical', {
            look_vertical: held.has('ArrowUp') ? 'up' : held.has('ArrowDown') ? 'down' : 'idle',
          })
          break
        case 'q':
        case 'e':
          climb(held.has('q') ? 1 : held.has('e') ? -1 : 0)
          break
        default:
          return
      }
      event.preventDefault()
    }
    const onDown = (e: KeyboardEvent) => handle(e, true)
    const onUp = (e: KeyboardEvent) => handle(e, false)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [phase, send, climb])

  const pause = useCallback(() => void send('pause'), [send])
  const resume = useCallback(() => void send('resume'), [send])

  return { status, phase, begin, end, pause, resume }
}
