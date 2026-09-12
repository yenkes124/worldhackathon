import { useHappyOyster, useHappyOysterTravelStatus } from '@reactor-models/happy-oyster/react'
import { useCallback, useEffect, useRef } from 'react'
import { scenePromptFor } from '../sim/reactions'
import type { Action } from '../sim/types'
import { headingFor, turnBetween, useExplorer } from './explorerStore'
import {
  CAPACITY_RETRY_DELAYS_MS,
  STEP_TRAVEL_MS,
  isCapacityError,
  sleep,
  turnDurationMs,
} from './useWorldSession'

export const FALLBACK_WORLD_MODEL = 'reactor/happy-oyster-adventure'
/**
 * HappyOyster fetches the starting image itself, so it must be a URL its
 * servers can reach (a dev-server path or an SDK upload is rejected with 400001).
 */
const PUBLIC_SEED_IMAGE_URL =
  (import.meta.env.VITE_SEED_IMAGE_URL as string | undefined) ??
  'https://raw.githubusercontent.com/yenkes124/worldhackathon/main/public/brain-seed.jpg'
/** HappyOyster has no per-chunk confirmations, so dead-reckon on a fixed tick. */
const TICK_MS = 500

type Translation = NonNullable<
  Parameters<ReturnType<typeof useHappyOyster>['hold']>[0]['translation']
>
type Rotation = NonNullable<Parameters<ReturnType<typeof useHappyOyster>['hold']>[0]['rotation']>

const translationFor = (held: Set<string>): Translation => {
  const f = held.has('w') && !held.has('s')
  const b = held.has('s') && !held.has('w')
  const l = held.has('a') && !held.has('d')
  const r = held.has('d') && !held.has('a')
  if (f) return l ? 'Front_Left' : r ? 'Front_Right' : 'Front'
  if (b) return l ? 'Back_Left' : r ? 'Back_Right' : 'Back'
  return l ? 'Left' : r ? 'Right' : 'None'
}

const rotationFor = (held: Set<string>): Rotation => {
  const u = held.has('ArrowUp') && !held.has('ArrowDown')
  const d = held.has('ArrowDown') && !held.has('ArrowUp')
  const l = held.has('ArrowLeft') && !held.has('ArrowRight')
  const r = held.has('ArrowRight') && !held.has('ArrowLeft')
  if (u) return l ? 'Mouse_Up_Left' : r ? 'Mouse_Up_Right' : 'Mouse_Up'
  if (d) return l ? 'Mouse_Down_Left' : r ? 'Mouse_Down_Right' : 'Mouse_Down'
  return l ? 'Mouse_Left' : r ? 'Mouse_Right' : 'None'
}

/** LingBot-style `+`-joined action string, so `advance()` integrates it unchanged. */
const actionFor = (held: Set<string>): string => {
  const tokens = ['w', 's', 'a', 'd'].filter((k) => held.has(k))
  if (held.has('ArrowLeft')) tokens.push('left')
  if (held.has('ArrowRight')) tokens.push('right')
  return tokens.length ? tokens.join('+') : 'still'
}

/**
 * Fallback driver on HappyOyster (adventure mode): builds a first-person world
 * from the brain seed + region prompt, streams a travel, and forwards WASD /
 * arrow keys as held axes. Grid position is dead-reckoned from the held keys
 * on a fixed tick since the model emits no chunk confirmations. Travels are
 * capped at two minutes upstream; a finished travel is restarted in place.
 */
export const useOysterSession = (fetchJwt: () => Promise<string>) => {
  const {
    phase: oysterPhase,
    connect,
    disconnect,
    createWorld,
    startTravel,
    endTravelSession,
    hold,
    stop,
  } = useHappyOyster()

  const phase = useExplorer((s) => s.phase)
  const cellType = useExplorer((s) => s.cellType)
  const setPhase = useExplorer((s) => s.setPhase)
  const setVertical = useExplorer((s) => s.setVertical)
  const onChunk = useExplorer((s) => s.onChunk)
  const stepNode = useExplorer((s) => s.step)
  const settle = useExplorer((s) => s.settle)
  const resetExplorer = useExplorer((s) => s.reset)

  const cancelledRef = useRef(false)
  const heldRef = useRef(new Set<string>())
  const tickRef = useRef(0)
  const legRef = useRef(0)

  const fail = useCallback(
    (error: unknown) => setPhase('error', error instanceof Error ? error.message : String(error)),
    [setPhase],
  )

  const begin = useCallback(async () => {
    resetExplorer()
    cancelledRef.current = false
    tickRef.current = 0
    legRef.current = 0
    setPhase('connecting')
    for (let attempt = 0; ; attempt += 1) {
      try {
        await connect(fetchJwt)
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const delay = CAPACITY_RETRY_DELAYS_MS[attempt]
        if (cancelledRef.current) return
        if (!isCapacityError(message) || delay === undefined) {
          setPhase('error', message)
          return
        }
        setPhase(
          'connecting',
          `${FALLBACK_WORLD_MODEL} has no free capacity either — retrying in ${delay / 1000}s`,
        )
        await sleep(delay)
        if (cancelledRef.current) return
        setPhase('connecting')
      }
    }
    try {
      setPhase('seeding')
      const prompt = scenePromptFor(cellType)
      try {
        await createWorld({
          prompt,
          firstFrameImageUrl: PUBLIC_SEED_IMAGE_URL,
          perspective: 'first_person',
        })
      } catch (error) {
        // Image unreachable from HappyOyster's side: build from the prompt alone.
        if (!/400001/.test(String(error instanceof Error ? error.message : error))) throw error
        if (cancelledRef.current) return
        await createWorld({ prompt, perspective: 'first_person' })
      }
      if (cancelledRef.current) return
      await startTravel()
      if (cancelledRef.current) return
      setPhase('exploring')
    } catch (error) {
      if (!cancelledRef.current) fail(error)
    }
    // cellType is read once at world-creation time on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, fetchJwt, createWorld, startTravel, resetExplorer, setPhase, fail])

  const end = useCallback(async () => {
    cancelledRef.current = true
    heldRef.current.clear()
    await disconnect().catch(() => undefined)
    setPhase('idle')
  }, [disconnect, setPhase])

  // Upstream travel budget ran out: reopen a travel on the same world.
  useHappyOysterTravelStatus((status) => {
    if (status !== 'completed' || cancelledRef.current) return
    if (useExplorer.getState().phase !== 'exploring') return
    legRef.current += 1
    startTravel().catch(fail)
  })

  useEffect(() => {
    if (oysterPhase === 'failed' && phase !== 'idle' && phase !== 'error') {
      setPhase('error', 'HappyOyster stream failed')
    }
  }, [oysterPhase, phase, setPhase])

  // Keyboard → held HappyOyster axes; dead-reckon the grid on a fixed tick.
  useEffect(() => {
    if (phase !== 'exploring') return
    const held = heldRef.current
    const push = () =>
      hold({
        translation: translationFor(held),
        rotation: rotationFor(held),
      }).catch(fail)
    const handle = (event: KeyboardEvent, down: boolean) => {
      if (event.repeat) return
      const k = event.key.length === 1 ? event.key.toLowerCase() : event.key
      switch (k) {
        case 'w':
        case 's':
        case 'a':
        case 'd':
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          if (down) held.add(k)
          else held.delete(k)
          push()
          break
        case 'q':
        case 'e':
          if (down) held.add(k)
          else held.delete(k)
          setVertical(held.has('q') ? 1 : held.has('e') ? -1 : 0)
          break
        default:
          return
      }
      event.preventDefault()
    }
    const onDown = (e: KeyboardEvent) => handle(e, true)
    const onUp = (e: KeyboardEvent) => handle(e, false)
    const timer = window.setInterval(() => {
      tickRef.current += 1
      onChunk(tickRef.current, actionFor(held))
    }, TICK_MS)
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      held.clear()
      stop().catch(() => undefined)
    }
  }, [phase, hold, stop, onChunk, setVertical, fail])

  // Adventure travels cannot be paused: "pause" releases every axis and
  // freezes dead-reckoning; "resume" simply re-arms the keyboard.
  const pause = useCallback(() => setPhase('paused'), [setPhase])
  const resume = useCallback(() => setPhase('exploring'), [setPhase])

  // Discrete node move: grid jumps at once; the camera glides forward briefly
  // (tilting for vertical steps) so the scenery visibly changes.
  const travellingRef = useRef(false)
  const stepTo = useCallback(
    async (action: Action) => {
      if (travellingRef.current || phase !== 'exploring') return
      const heading = useExplorer.getState().nav.heading
      const prediction = stepNode(action)
      if (!prediction) return
      travellingRef.current = true
      const target = headingFor(action)
      const turn = target === undefined ? 0 : turnBetween(heading, target)
      const dz = prediction.action.delta[2]
      try {
        if (Math.abs(turn) >= 1) {
          await hold({
            translation: 'None',
            rotation: turn > 0 ? 'Mouse_Right' : 'Mouse_Left',
          })
          await sleep(turnDurationMs(turn))
        }
        await hold({
          translation: 'Front',
          rotation: dz > 0 ? 'Mouse_Up' : dz < 0 ? 'Mouse_Down' : 'None',
        })
        await sleep(STEP_TRAVEL_MS)
        await hold({
          translation: translationFor(heldRef.current),
          rotation: rotationFor(heldRef.current),
        })
      } catch (error) {
        fail(error)
      } finally {
        settle(target ?? heading)
        travellingRef.current = false
      }
    },
    [phase, hold, stepNode, settle, fail],
  )

  const resetPosition = useCallback(async () => {
    if (travellingRef.current || phase !== 'exploring') return
    travellingRef.current = true
    const turn = turnBetween(useExplorer.getState().nav.heading, 0)
    resetExplorer()
    try {
      if (Math.abs(turn) >= 1) {
        await hold({
          translation: 'None',
          rotation: turn > 0 ? 'Mouse_Right' : 'Mouse_Left',
        })
        await sleep(turnDurationMs(turn))
        await hold({ translation: 'None', rotation: 'None' })
      }
    } catch (error) {
      fail(error)
    } finally {
      settle(0)
      travellingRef.current = false
    }
  }, [phase, hold, resetExplorer, fail, settle])

  return {
    status: oysterPhase,
    phase,
    begin,
    end,
    pause,
    resume,
    stepTo,
    resetPosition,
    endTravelSession,
  }
}
