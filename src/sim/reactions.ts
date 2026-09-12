import { CELL_META } from './cellMeta'
import type { CellType } from './types'

export type ReactionSeverity = 'none' | 'mild' | 'severe' | 'critical'

/**
 * What the invented body "does" when the probe sits in a cell of this type.
 *
 * Purely educational storytelling for the synthetic scenario. The wording is
 * derived from the cell's symbolic risk / reward / noGo values in CELL_META,
 * not from any physiological model, and must never be read as real anatomy.
 */
export interface BodyReaction {
  type: CellType
  severity: ReactionSeverity
  headline: string
  body: string
  /** Prompt fragment that restyles the generated world for this region. */
  scenePrompt: string
}

const REACTIONS: Record<CellType, Omit<BodyReaction, 'type' | 'severity'>> = {
  ENT: {
    headline: 'Nothing happens yet',
    body: 'The probe rests in a permitted entry corridor on the superior surface. The synthetic body shows no response.',
    scenePrompt:
      'a calm cyan-lit entry corridor at the top of a stylised fictional brain cavern, soft glowing walls, gentle drifting sparks',
  },
  WM_SAFE: {
    headline: 'Quiet passage',
    body: 'Safe white-matter analogue. In this simulation traversing it produces no motor or sensory change — only a small amount of accumulated risk.',
    scenePrompt:
      'a smooth grey-blue tunnel of fibrous stylised white matter, dim even light, fictional brain interior, calm',
  },
  MOT_HAND: {
    headline: 'Right hand twitches — no-go',
    body: 'The scenario’s highlighted hand motor context. Entering it in the simulation would make the synthetic right hand jerk and the tremor worsen; the planner treats it as forbidden.',
    scenePrompt:
      'dense amber-gold pulsing folds of stylised motor cortex crackling with electric sparks, warning glow, fictional brain interior',
  },
  MOT_ARM: {
    headline: 'Right arm jerks — no-go',
    body: 'Arm motor analogue. Contact here would flex the synthetic right arm involuntarily. Hard constraint for the planner.',
    scenePrompt:
      'bright orange pulsing folds of stylised motor cortex, electric arcs, warning glow, fictional brain interior',
  },
  MOT_LEG: {
    headline: 'Right leg kicks — no-go',
    body: 'Leg motor analogue. Stimulation here would produce an involuntary kick in the synthetic body. Hard constraint for the planner.',
    scenePrompt:
      'amber pulsing folds of stylised motor cortex, electric arcs along the walls, warning glow, fictional brain interior',
  },
  MOT_TRUNK: {
    headline: 'Trunk stiffens — no-go',
    body: 'Trunk motor analogue. The synthetic torso would tense and twist. Hard constraint for the planner.',
    scenePrompt:
      'amber pulsing folds of stylised motor cortex, heavy electric hum, warning glow, fictional brain interior',
  },
  MOT_FACE: {
    headline: 'Face grimaces — no-go',
    body: 'Face motor analogue. Contact would pull the synthetic face into a grimace and slur speech. Hard constraint for the planner.',
    scenePrompt:
      'amber pulsing folds of stylised motor cortex, flickering sparks, warning glow, fictional brain interior',
  },
  SENS: {
    headline: 'Tingling in the right side — no-go',
    body: 'Somatosensory analogue posterior to the target. The synthetic body would report tingling and numbness down the right side.',
    scenePrompt:
      'shimmering sky-blue rippling folds of stylised sensory cortex, waves of light travelling along the walls, fictional brain interior',
  },
  THAL: {
    headline: 'Faint tremor change',
    body: 'Generic deep thalamic tissue. Near the tremor network the synthetic tremor flickers slightly but does not settle.',
    scenePrompt:
      'deep violet glowing chambers of stylised thalamic tissue, slow pulsing light, fictional brain interior',
  },
  VIM_NEAR: {
    headline: 'Tremor eases',
    body: 'Border zone of the tremor network. The synthetic right-hand tremor visibly calms as the probe approaches the target cell.',
    scenePrompt:
      'soft lavender glowing chamber approaching a bright green core, steadying rhythmic light, fictional brain interior',
  },
  VIM_TARGET: {
    headline: 'Tremor stops',
    body: 'The conceptual tremor-network goal. In the simulation the synthetic right hand becomes still — the scenario’s success condition.',
    scenePrompt:
      'a luminous emerald-green crystalline core at the heart of a stylised fictional brain cavern, serene steady light, no sparks',
  },
  IC_AVOID: {
    headline: 'Right side goes weak — critical',
    body: 'Internal-capsule analogue: a dense synthetic fibre bundle. Damage here would leave the synthetic body’s right side weak. Highest risk, hard no-go.',
    scenePrompt:
      'a tight bundle of red glowing fibre cables running through a stylised fictional brain, alarm-red light, tense',
  },
  VENT_AVOID: {
    headline: 'Fluid breach — critical',
    body: 'Ventricle analogue. Puncturing the fluid-filled cavity would cause pressure changes and headache in the synthetic body. Hard no-go.',
    scenePrompt:
      'a dark rose-tinted fluid-filled cavern with slow ripples, cold light, stylised fictional brain interior',
  },
  BRAINSTEM_AVOID: {
    headline: 'Breathing falters — critical',
    body: 'Brainstem analogue. The synthetic body’s breathing and heart rhythm would become unstable. Hard no-go.',
    scenePrompt:
      'a narrow crimson stem of glowing tissue descending into darkness, deep red alarm light, stylised fictional brain interior',
  },
  CEREB_NET: {
    headline: 'Balance lost — no-go',
    body: 'Cerebellar relay network. The synthetic body would lose coordination and balance. Modelled but never traversed.',
    scenePrompt:
      'finely folded pink-red stylised cerebellar tissue with branching tree-like patterns, dim light, fictional brain interior',
  },
  OUTSIDE: {
    headline: 'Outside the modelled volume',
    body: 'Beyond the simulated left-hemisphere cutaway. Nothing is modelled here; the probe cannot enter.',
    scenePrompt: 'a dark empty void at the edge of a stylised fictional brain cavern, faint outline of tissue behind',
  },
}

const severityFor = (type: CellType): ReactionSeverity => {
  const meta = CELL_META[type]
  if (!meta.noGo) return type === 'ENT' ? 'none' : 'mild'
  return meta.risk >= 1 ? 'critical' : 'severe'
}

export const bodyReaction = (type: CellType): BodyReaction => ({
  type,
  severity: severityFor(type),
  ...REACTIONS[type],
})

export const SCENE_PROMPT_PREFIX =
  'First-person camera slowly exploring the inside of a stylised, clearly fictional brain: '

export const SCENE_PROMPT_SUFFIX =
  '. Volumetric light, thin luminous neuron filaments, semi-realistic 3D render. The camera moves; the scene stays still. No text, no people.'

export const scenePromptFor = (type: CellType): string =>
  `${SCENE_PROMPT_PREFIX}${REACTIONS[type].scenePrompt}${SCENE_PROMPT_SUFFIX}`
