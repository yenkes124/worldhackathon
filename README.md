# NeuroGrid

**Live demo: https://dist-ybevshzg.devinapps.com**

A virtual robotic electrode plans a safe route through a stylised 4×4×4 brain
grid to a conceptual tremor-network target — and shows you its reasoning one
step at a time.

> **Not medical software.** NeuroGrid is an educational hackathon proof of
> concept. The brain shape is procedurally generated, the coordinates are
> invented, and the risk and reward numbers are made up. It is not
> patient-specific planning, diagnosis, or surgical guidance, and it must never
> be used for clinical purposes.

---

## What you are looking at

**The 3D scene (left).** A translucent, procedurally generated brain shell with
a 4×4×4 grid of coloured voxels inside it. Each voxel is one cell of synthetic
tissue:

- **cyan** — `ENT`, a valid entry corridor. These are clickable.
- **green** — `VIM_TARGET` at `[1, 1, 1]`, the goal.
- **purple** — thalamic cells.
- **red / pink** — no-go tissue the probe must never pass through.
- **slate** — `WM_SAFE`, safe white matter to travel through.

The glowing shaft is the probe. The green line is its planned route; the red
line (when enabled) is a rejected route.

**The dashboard (right).** Four panels: what the probe predicts will happen on
its next move, the controls, the metrics for the planned route, and the colour
legend.

## What you are supposed to do

1. **Read the intro overlay**, then press *Enter the simulation*.
2. **Press Step.** Before the probe moves, the *World-model prediction* panel
   already shows where it thinks it will end up, what tissue is there, and the
   risk and reward of going. Press Step again and watch the prediction come
   true — that is the whole point: the probe is planning against a model of the
   world, not feeling its way forward.
3. **Press Run** to animate the rest of the trajectory, *Pause* to stop it
   mid-flight, *Reset* to return to the entry point.
4. **Press "Show unsafe direct route".** A red route appears: the shortest,
   most obvious path to the target. The panel tells you exactly why the planner
   refused it — it passes through `MOT_HAND` at `[1, 1, 3]`. This is the
   contrast that makes the safe route interesting.
5. **Click a different cyan voxel** in the 3D scene, or use the entry selector.
   The route is replanned instantly from the new entry, and still reaches the
   target without touching forbidden tissue.
6. **Switch to Learner Demo.** Instead of searching for the optimal route, this
   mode runs 240 seeded trial-and-error episodes and keeps the best safe
   trajectory it stumbled onto. It is longer and less elegant than A\* — that
   difference is the interesting part. Reset and re-run: it is seeded, so it
   finds the identical route every time.
7. **Drag to orbit, scroll to zoom**, and hover any voxel to see its
   coordinates and tissue label.

## How it works

Everything is built on one deterministic function, the *world model*:

> given a cell and a direction, predict the next cell, its tissue label, its
> risk, and its reward.

Nothing else in the app knows the grid. The prediction panel renders that
function's output directly, and both planners consume it and nothing else:

- **A\* planner** — a risk-weighted shortest-path search. Forbidden tissue is
  removed from consideration *before* the search sees it, so a no-go cell is a
  hard constraint rather than an expensive shortcut the planner could decide to
  take anyway. It reports how many cells it expanded.
- **Learner demo** — seeded random rollouts that consult the same one-step
  predictions and keep the best safe trajectory found. Deterministic for a
  given seed, so the demo behaves identically every time.

The "failed candidate" is deliberately constructed: it walks x, then y, then z
to the target, which from any entry runs through the hand motor cell — a clean,
explainable failure.

### Coordinate convention

| Axis | 0 | 3 |
| --- | --- | --- |
| `x` | left | right |
| `y` | anterior | posterior |
| `z` | inferior | superior |

### Cell types

`ENT`, `WM_SAFE`, `MOT_LEG`, `MOT_TRUNK`, `MOT_ARM`, `MOT_HAND`, `MOT_FACE`,
`SENS`, `THAL`, `VIM_NEAR`, `VIM_TARGET`, `IC_AVOID`, `VENT_AVOID`,
`BRAINSTEM_AVOID`, `CEREB_NET`, `OUTSIDE`.

Hard no-go: every motor cortical cell, `SENS`, `IC_AVOID`, `VENT_AVOID`,
`BRAINSTEM_AVOID`, `CEREB_NET`, and `OUTSIDE` (leaving the volume).

### The scenario

Right-hand tremor, approached in the left hemisphere because the modelled motor
pathways cross the midline. The left hand motor representation (`MOT_HAND` at
`[1, 1, 3]`) sits directly above the target and is forbidden, which is what
forces the planner to approach from the side. Entry corridors: `[0, 0, 3]`,
`[1, 0, 3]`, `[0, 1, 3]`. Target: `[1, 1, 1]`.

## Running it locally

Requires Node.js ≥ 20.19 (22 recommended — see `.nvmrc`).

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build      # type-check and production build
npm run test       # vitest unit tests
npm run lint       # oxlint
npm run typecheck  # tsc -b
```

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

`src/sim/` imports neither React nor three.js, so the planner and world model
are tested in isolation. `simulation.test.ts` covers bounds checking,
transition determinism, no-go cells as hard constraints, target reachability
from every entry with contiguous unit steps, the failed candidate always
violating a constraint, and learner reproducibility.

## Limitations

- The geometry is procedural and non-anatomical; nothing here is derived from
  imaging or an atlas.
- A 4×4×4 grid with six axis-aligned moves is far coarser than any real
  trajectory space.
- Risk and reward are hand-authored constants chosen to make the demo legible,
  not measurements.
- The learner is a seeded heuristic rollout search for demonstration, not a
  trained reinforcement-learning agent.
- No persistence, no backend, and no notion of a patient or a case.
