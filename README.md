# NeuroGrid

Synthetic world-model simulation of a virtual robotic electrode planning a safe
trajectory through a stylised 4×4×4 brain grid toward a conceptual
tremor-network target.

> **Not medical software.** NeuroGrid is an educational hackathon proof of
> concept. The brain shape is procedurally generated, the coordinates are
> invented, and the risk and reward numbers are made up. It is not
> patient-specific planning, diagnosis, or surgical guidance, and it must never
> be used for clinical purposes.

## What it demonstrates

A deterministic *world model* — given a cell and an action, it predicts the next
cell, its tissue label, and the associated risk and reward — driving two
trajectory strategies:

- **A\* planner** — risk-weighted search where forbidden tissue is filtered out
  before it ever reaches the frontier, so no-go cells are hard constraints
  rather than expensive shortcuts.
- **Learner demo** — seeded rollouts that only consult the same one-step
  predictions, keeping the best safe trajectory they discover. Reproducible for
  a given seed.

A "show failed candidate" toggle renders the naive shortest axis-aligned route
in red and explains exactly which constraint rejects it.

## Coordinate convention

| Axis | 0 | 3 |
| --- | --- | --- |
| `x` | left | right |
| `y` | anterior | posterior |
| `z` | inferior | superior |

The scenario target `VIM_TARGET` sits at `[1, 1, 1]`.

## Cell types

`ENT`, `WM_SAFE`, `MOT_LEG`, `MOT_TRUNK`, `MOT_ARM`, `MOT_HAND`, `MOT_FACE`,
`SENS`, `THAL`, `VIM_NEAR`, `VIM_TARGET`, `IC_AVOID`, `VENT_AVOID`,
`BRAINSTEM_AVOID`, `CEREB_NET`, `OUTSIDE`.

Hard no-go for the planner: every motor cortical cell, `SENS`, `IC_AVOID`,
`VENT_AVOID`, `BRAINSTEM_AVOID`, `CEREB_NET` and `OUTSIDE`.

## Scenario: right-hand tremor

Because the modelled motor pathways cross the midline, a right-hand tremor is
approached in the left hemisphere. The left hand motor representation
(`MOT_HAND` at `[1, 1, 3]`) is highlighted as context and is a hard no-go, which
is what makes the naive "straight down from above the target" route fail.

Entry corridors (`ENT`): `[0, 0, 3]`, `[1, 0, 3]`, `[0, 1, 3]`.

## Setup

Requires Node.js ≥ 20.19 (22 recommended — see `.nvmrc`).

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build      # type-check and production build
npm run test       # vitest unit tests
npm run lint       # oxlint
npm run typecheck  # tsc -b
```

## Demo flow

1. Read the intro overlay and press **Enter the simulation**.
2. Keep the default entry `[1, 0, 3]`. The A\* planner produces
   `[1,0,3] → [1,0,2] → [1,1,2] → [1,1,1]`.
3. Press **Step** and watch the prediction panel: current cell, chosen action,
   predicted next cell, predicted label, risk and reward, all before the probe
   moves.
4. Press **Run** to animate the electrode along the whole trajectory.
5. Toggle **Show unsafe direct route**: the red route drops straight through
   `MOT_HAND` at `[1, 1, 3]` and the panel explains the rejection.
6. Switch to **Learner Demo** to see a longer but still constraint-respecting
   trajectory found by seeded rollouts.
7. Click a different cyan `ENT` voxel in the 3D scene and watch the plan and
   metrics update.

## Architecture

```
src/
  sim/                 pure simulation logic, no React
    types.ts           shared domain types
    cellMeta.ts        per-cell-type colour, risk, reward, no-go flag
    grid.ts            4×4×4 volume, bounds checks, scene-space mapping
    scenario.ts        the right-hand-tremor scenario definition
    worldModel.ts      actions and deterministic transition prediction
    planner.ts         A*, naive unsafe route, path evaluation, learner
    rng.ts             seeded PRNG
    simulation.test.ts unit tests
  state/
    simulationStore.ts zustand store and selectors
  components/
    scene/             react-three-fiber scene (brain shell, voxels, probe)
    ui/                dashboard panels, safety banner, intro overlay
```

Simulation logic is deliberately free of React and three.js imports, so the
planner and world model are testable in isolation.

## Tests

`src/sim/simulation.test.ts` covers:

- bounds checking, including non-integer and out-of-volume coordinates
- deterministic transition prediction, boundary behaviour, risk and reward
- no-go cells as hard constraints (never planned through, never a valid start)
- target reachability from every entry point, with contiguous unit steps
- the failed candidate always violating a constraint, and the learner being
  reproducible from its seed

## Limitations

- The geometry is procedural and non-anatomical; nothing here is derived from
  imaging or an atlas.
- A 4×4×4 grid with six axis-aligned actions is far coarser than any real
  trajectory space.
- Risk and reward values are hand-authored constants chosen to make the demo
  legible, not measurements.
- The learner is a seeded heuristic rollout search for demonstration, not a
  trained reinforcement-learning agent.
- There is no persistence, no backend, and no notion of a patient or a case.
