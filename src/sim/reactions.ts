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
      'a shallow cleft between soft pale pink-grey cortical folds just beneath the surface, a thin translucent membrane overhead, fine red capillaries, cool even light',
  },
  WM_SAFE: {
    headline: 'Quiet passage',
    body: 'Safe white-matter analogue. In this simulation traversing it produces no motor or sensory change — only a small amount of accumulated risk.',
    scenePrompt:
      'a snug passage between smooth cream-white myelinated fibre bundles running in parallel, moist pale tissue, faint pink vessels, calm neutral light',
  },
  MOT_HAND: {
    headline: 'Right hand twitches — no-go',
    body: 'The scenario’s highlighted hand motor context. Entering it in the simulation would make the synthetic right hand jerk and the tremor worsen; the planner treats it as forbidden.',
    scenePrompt:
      'a tight fold of dense pink-grey motor cortex, thick red arterioles branching across the glistening surface, tissue tinged warm and inflamed',
  },
  MOT_ARM: {
    headline: 'Right arm jerks — no-go',
    body: 'Arm motor analogue. Contact here would flex the synthetic right arm involuntarily. Hard constraint for the planner.',
    scenePrompt:
      'plump pink-grey folds of motor cortex crowding the view, engorged red vessels, warm reddish tint on wet tissue',
  },
  MOT_LEG: {
    headline: 'Right leg kicks — no-go',
    body: 'Leg motor analogue. Stimulation here would produce an involuntary kick in the synthetic body. Hard constraint for the planner.',
    scenePrompt:
      'ridged pink-grey folds of motor cortex pressing close, branching red vessels, warm reddish tint',
  },
  MOT_TRUNK: {
    headline: 'Trunk stiffens — no-go',
    body: 'Trunk motor analogue. The synthetic torso would tense and twist. Hard constraint for the planner.',
    scenePrompt:
      'broad pink-grey folds of motor cortex with a heavy vascular web, warm reddish tint on moist tissue',
  },
  MOT_FACE: {
    headline: 'Face grimaces — no-go',
    body: 'Face motor analogue. Contact would pull the synthetic face into a grimace and slur speech. Hard constraint for the planner.',
    scenePrompt:
      'small tightly packed folds of pink-grey motor cortex, fine red capillaries everywhere, warm reddish tint',
  },
  SENS: {
    headline: 'Tingling in the right side — no-go',
    body: 'Somatosensory analogue posterior to the target. The synthetic body would report tingling and numbness down the right side.',
    scenePrompt:
      'smooth pale rose folds of sensory cortex with faint bluish veins beneath a wet translucent surface, cool grey-pink light',
  },
  THAL: {
    headline: 'Faint tremor change',
    body: 'Generic deep thalamic tissue. Near the tremor network the synthetic tremor flickers slightly but does not settle.',
    scenePrompt:
      'a rounded chamber of dense pale grey-mauve thalamic tissue with a fine granular texture, small dark vessels, soft dim light',
  },
  VIM_NEAR: {
    headline: 'Tremor eases',
    body: 'Border zone of the tremor network. The synthetic right-hand tremor visibly calms as the probe approaches the target cell.',
    scenePrompt:
      'compact grey-mauve deep tissue with tiny pale nuclei visible in the wall, sparse thin vessels, quiet dim light',
  },
  VIM_TARGET: {
    headline: 'Tremor stops',
    body: 'The conceptual tremor-network goal. In the simulation the synthetic right hand becomes still — the scenario’s success condition.',
    scenePrompt:
      'a small rounded pocket of smooth pale grey-mauve tissue, evenly lit, delicate pale fibres arriving from below, still and undisturbed',
  },
  IC_AVOID: {
    headline: 'Right side goes weak — critical',
    body: 'Internal-capsule analogue: a dense synthetic fibre bundle. Damage here would leave the synthetic body’s right side weak. Highest risk, hard no-go.',
    scenePrompt:
      'a thick dense cable of tightly packed cream-white fibre bundles crossing the path, stretched taut, deep red arteries alongside',
  },
  VENT_AVOID: {
    headline: 'Fluid breach — critical',
    body: 'Ventricle analogue. Puncturing the fluid-filled cavity would cause pressure changes and headache in the synthetic body. Hard no-go.',
    scenePrompt:
      'the edge of a dark cavity filled with clear fluid, a smooth glistening ependymal lining, faint reflections on the water surface',
  },
  BRAINSTEM_AVOID: {
    headline: 'Breathing falters — critical',
    body: 'Brainstem analogue. The synthetic body’s breathing and heart rhythm would become unstable. Hard no-go.',
    scenePrompt:
      'a narrowing stalk of dense tissue descending steeply, thick red vertebral arteries hugging its surface, deep shadow below',
  },
  CEREB_NET: {
    headline: 'Balance lost — no-go',
    body: 'Cerebellar relay network. The synthetic body would lose coordination and balance. Modelled but never traversed.',
    scenePrompt:
      'very fine tightly folded pinkish tissue layered like thin leaves, delicate branching pale fibres inside each fold, dim light',
  },
  OUTSIDE: {
    headline: 'Outside the modelled volume',
    body: 'Beyond the simulated left-hemisphere cutaway. Nothing is modelled here; the probe cannot enter.',
    scenePrompt:
      'the outer surface of soft tissue giving way to a dark empty gap, faint membrane, nothing beyond',
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
  'Macro close-up camera drifting slowly through the soft living tissue of a fictional synthetic brain, photorealistic medical render: '

export const SCENE_PROMPT_SUFFIX =
  '. Wet organic tissue on every side, gentle specular highlights, muted natural rose and beige tones, shallow depth of field, soft diffuse light, smooth steady motion, nothing but tissue in view.'

export const scenePromptFor = (type: CellType): string =>
  `${SCENE_PROMPT_PREFIX}${REACTIONS[type].scenePrompt}${SCENE_PROMPT_SUFFIX}`
