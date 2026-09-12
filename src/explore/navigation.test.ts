import { describe, expect, it } from 'vitest'
import { LEGEND_ORDER } from '../sim/cellMeta'
import { cellTypeAt } from '../sim/grid'
import { bodyReaction, scenePromptFor } from '../sim/reactions'
import type { Vec3 } from '../sim/types'
import {
  CELL_PER_CHUNK,
  YAW_PER_CHUNK,
  advance,
  cellOf,
  headingLabel,
  initialNav,
} from './navigation'

const ENTRY: Vec3 = [1, 0, 3]

const repeat = (
  nav: ReturnType<typeof initialNav>,
  action: string,
  times: number,
  vertical: -1 | 0 | 1 = 0,
) => {
  let state = nav
  for (let i = 0; i < times; i += 1) state = advance(state, action, vertical)
  return state
}

describe('explorer dead-reckoning', () => {
  it('starts on the entry cell facing posterior', () => {
    const nav = initialNav(ENTRY)
    expect(cellOf(nav.position)).toEqual(ENTRY)
    expect(headingLabel(nav.heading)).toBe('posterior')
  })

  it('walks forward one cell after 1 / CELL_PER_CHUNK chunks', () => {
    const nav = repeat(initialNav(ENTRY), 'w', Math.round(1 / CELL_PER_CHUNK))
    expect(cellOf(nav.position)).toEqual([1, 1, 3])
    expect(cellTypeAt(cellOf(nav.position))).toBe('MOT_HAND')
  })

  it('descends with a vertical pose and reaches the target', () => {
    let nav = repeat(initialNav(ENTRY), 'still', 10, -1)
    expect(cellOf(nav.position)).toEqual([1, 0, 1])
    nav = repeat(nav, 'w', 5)
    expect(cellOf(nav.position)).toEqual([1, 1, 1])
    expect(cellTypeAt(cellOf(nav.position))).toBe('VIM_TARGET')
  })

  it('turns 90° after 90 / YAW_PER_CHUNK look chunks and strafes correctly', () => {
    let nav = repeat(initialNav(ENTRY), 'right', 90 / YAW_PER_CHUNK)
    expect(headingLabel(nav.heading)).toBe('right')
    nav = repeat(nav, 'a', 5) // facing +x, left is +y (posterior)
    expect(cellOf(nav.position)).toEqual([1, 1, 3])
    nav = repeat(nav, 'd', 5) // strafe right → back to −y
    expect(cellOf(nav.position)).toEqual([1, 0, 3])
  })

  it('treats OUTSIDE cells as walls', () => {
    let nav = repeat(initialNav(ENTRY), 'right', 90 / YAW_PER_CHUNK)
    nav = repeat(nav, 'w', 20) // toward x = 3, which is OUTSIDE on every layer
    expect(cellOf(nav.position)[0]).toBeLessThanOrEqual(1)
    expect(cellTypeAt(cellOf(nav.position))).not.toBe('OUTSIDE')
  })

  it('is deterministic for identical action sequences', () => {
    const script = ['w', 'w+a', 'left', 'w', 'still', 's+right']
    const run = () => script.reduce((nav, a) => advance(nav, a, -1), initialNav(ENTRY))
    expect(run()).toEqual(run())
  })

  it('ignores unknown action tokens', () => {
    const nav = initialNav(ENTRY)
    expect(advance(nav, 'jump+fly')).toEqual(nav)
  })
})

describe('body reactions', () => {
  it('defines a reaction and scene prompt for every cell type', () => {
    for (const type of LEGEND_ORDER) {
      const reaction = bodyReaction(type)
      expect(reaction.headline.length).toBeGreaterThan(0)
      expect(reaction.body.length).toBeGreaterThan(0)
      expect(scenePromptFor(type)).toContain('fictional')
    }
  })

  it('derives severity from the symbolic cell metadata', () => {
    expect(bodyReaction('ENT').severity).toBe('none')
    expect(bodyReaction('WM_SAFE').severity).toBe('mild')
    expect(bodyReaction('VIM_TARGET').severity).toBe('mild')
    expect(bodyReaction('MOT_HAND').severity).toBe('severe')
    expect(bodyReaction('IC_AVOID').severity).toBe('critical')
    expect(bodyReaction('BRAINSTEM_AVOID').severity).toBe('critical')
  })
})
