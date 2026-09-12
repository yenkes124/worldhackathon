import { cellsOfType } from './grid'
import type { Scenario, Vec3 } from './types'

export const VIM_TARGET_POSITION: Vec3 = [1, 1, 1]

export const RIGHT_HAND_TREMOR: Scenario = {
  id: 'right-hand-tremor',
  title: 'Right-hand tremor — left hemisphere approach',
  summary:
    'A synthetic right-hand tremor case. Because the modelled motor pathways cross the midline, the simulation works in the left hemisphere and highlights the left hand motor context.',
  context:
    'The conceptual tremor-network target sits at [1, 1, 1] (left, anterior, inferior). The probe must reach it from a superior entry corridor without entering eloquent motor or sensory tissue, the internal-capsule analogue, the ventricle analogue, the brainstem analogue, or the cerebellar network.',
  target: VIM_TARGET_POSITION,
  entries: cellsOfType('ENT'),
  seed: 20240917,
}

export const HIGHLIGHT_CONTEXT: Vec3[] = cellsOfType('MOT_HAND')
