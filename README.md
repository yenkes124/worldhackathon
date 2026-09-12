# NeuroGrid

**Live demo: https://dist-kezvdffb.devinapps.com**

A virtual robotic electrode reaches a conceptual tremor-network target inside a
stylised 4×4×4 brain grid — and shows you its reasoning one step at a time. It
does this in two ways: **Guided Planner**, which already knows the whole world
and plans the full route up front, and **Explore and Learn**, which starts with
an almost empty knowledge map and has to discover the restricted regions for
itself.

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
- **red / pink** — restricted tissue the probe must never pass through.
- **slate** — `WM_SAFE`, safe white matter to travel through.

The glowing shaft is the probe. The green line is its route; the red line (in
Guided Planner, when enabled) is a rejected counterfactual route.

**The dashboard (right).** The top panel picks the mode. Everything below it
belongs to the mode you selected, with the colour legend at the bottom.

## Mode 1 — Guided Planner

The agent has complete knowledge of the synthetic environment and plans the
whole route before it moves.

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
   sub-mode runs 240 seeded trial-and-error episodes and keeps the best safe
   trajectory it stumbled onto. It is longer and less elegant than A\* — that
   difference is the interesting part. Reset and re-run: it is seeded, so it
   finds the identical route every time.

## Mode 2 — Explore and Learn

The agent begins with an incomplete knowledge map: the three entry corridors
are known, the target at `[1, 1, 1]` is known, and **all 60 other cells are
UNKNOWN** — no tissue label, no restriction flag, nothing. It learns the world
only by asking the synthetic environment, one simulated safety check at a time.

The loop is **observe → predict → simulated safety check → learn → replan**.

In this mode the 3D scene is the knowledge map, not the hidden world: unknown
cells are uniform grey, and a cell only takes on a colour once a check has
revealed it. The cell about to be checked is ringed in amber and labelled
`CHECKING`; after the check that ring turns green (`PASSED`) or red
(`REJECTED`), and the arrow line under the buttons always names the next button
to press.

### Walk through the default discovery

1. Select **Explore and Learn** in the Mode panel.
2. Pick the entry `[0, 0, 3]` and press **Start Explore**. A counterfactual
   route is proposed over the knowledge map alone — it happily routes through
   unknown cells, because the agent has no reason yet to avoid them.
3. **Predict Next Step.** The panel shows the next position the agent expects,
   its confidence, and its predicted risk. A known entry cell gives 100%
   confidence; an unknown cell gives 10% and a risk of *unknown*.
4. **Run Simulated Safety Check.** The synthetic environment checks that one
   cell and returns an observation. `[0, 1, 3]` comes back permitted: the
   verdict block turns green, the probe advances, and the cell is recorded at
   100% confidence. A cell that was unknown before the check becomes *confirmed
   safe* and lights up green in the scene.
5. **Predict Next Step** again. The route wants `[1, 1, 3]`, still unknown.
6. **Run Simulated Safety Check** again. This time the environment reveals a
   restricted region. The verdict block turns red and spells out that the probe
   stayed put, the cell became *confirmed restricted*, and the prediction was
   wrong. The cell turns red in the scene and the decision log records:
   *"Route rejected before execution: the synthetic environment revealed a
   restricted region."*
7. **Replan.** The new route is computed from the updated knowledge map and
   avoids the cell the agent just learned about.
8. Keep alternating **Predict Next Step** and **Run Simulated Safety Check**
   (replanning after any rejection) until the probe reaches `[1, 1, 1]`.

**Reset Explore** clears the knowledge map and starts a fresh session from the
selected entry. Choosing a different entry also resets it. The target is fixed
at `[1, 1, 1]`.

### What the panel tells you

Current position, next predicted position, prediction confidence, predicted
risk, a pass/reject verdict for the latest simulated safety check — with
whether the probe moved, what the cell is now, and whether the prediction was
right — safe cells confirmed, restricted cells discovered, prediction accuracy,
replans completed, the size of the current counterfactual route, and a running
decision log. The
*Knowledge map* legend names the five states a cell can be in: unknown,
confirmed safe, confirmed restricted, known entry, known target.

## How it works

### Guided Planner

Everything is built on one deterministic function, the *world model*:

> given a cell and a direction, predict the next cell, its tissue label, its
> risk, and its reward.

The prediction panel renders that function's output directly, and both guided
planners consume it and nothing else:

- **A\* planner** — a risk-weighted shortest-path search. Forbidden tissue is
  removed from consideration *before* the search sees it, so a restricted cell
  is a hard constraint rather than an expensive shortcut the planner could
  decide to take anyway. It reports how many cells it expanded.
- **Learner demo** — seeded random rollouts that consult the same one-step
  predictions and keep the best safe trajectory found. Deterministic for a
  given seed, so the demo behaves identically every time.

The "failed candidate" is deliberately constructed: it walks x, then y, then z
to the target, which from any entry runs through the hand motor cell — a clean,
explainable failure.

### Explore and Learn

Explore mode enforces an architectural split between **hidden ground truth**
and **agent knowledge**:

| Module | May read the hidden grid? | Role |
| --- | --- | --- |
| `agentKnowledge.ts` | no | the knowledge map and its updates |
| `explorePredict.ts` | no | predicts one step from knowledge alone |
| `explorePlanner.ts` | no | deterministic Dijkstra over the knowledge map |
| `simulationValidator.ts` | **yes** | the simulated safety check |

The validator is the only place the true cell labels are read. It returns a
structured observation — allowed to advance or not, the actual label, whether
the prediction matched, and the knowledge update to apply — and the store
applies that update. A unit test reads the source of the prediction and planner
modules and fails if either ever imports the ground-truth helpers.

The knowledge-only planner costs cells by status: confirmed safe, known entry
and known target are cheap; unknown carries an exploration penalty; predicted
risk is very expensive; confirmed restricted is impassable. Ties break on
position key, so the same knowledge state always produces the same route, and
an unreachable target returns a structured "no route known" result instead of
throwing.

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
forces the guided planner to approach from the side — and what the exploring
agent discovers for itself. Entry corridors: `[0, 0, 3]`, `[1, 0, 3]`,
`[0, 1, 3]`. Target: `[1, 1, 1]`.

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
  sim/                     pure simulation logic, no React
    types.ts               shared domain types
    cellMeta.ts            per-cell-type colour, risk, reward, no-go flag
    grid.ts                4×4×4 volume, bounds checks, scene-space mapping
    scenario.ts            the right-hand-tremor scenario definition
    worldModel.ts          actions and deterministic transition prediction
    planner.ts             A*, naive unsafe route, path evaluation, learner
    agentKnowledge.ts      explore knowledge map (no ground truth)
    explorePredict.ts      one-step prediction from knowledge (no ground truth)
    explorePlanner.ts      knowledge-only deterministic route search
    simulationValidator.ts the simulated safety check (reads ground truth)
    rng.ts                 seeded PRNG
    simulation.test.ts     guided-mode unit tests
    explore.test.ts        explore-mode unit tests
  state/
    simulationStore.ts     zustand store and selectors for both modes
  components/
    scene/                 react-three-fiber scene (brain shell, voxels, probe)
    ui/                    mode selector, dashboard panels, banner, overlay
```

`src/sim/` imports neither React nor three.js, so the planners, the world model
and the explore loop are tested in isolation. `simulation.test.ts` covers
bounds checking, transition determinism, no-go cells as hard constraints,
target reachability from every entry, the failed candidate always violating a
constraint, and learner reproducibility. `explore.test.ts` covers the initial
knowledge map, prediction isolation from ground truth, learning from
observations, replanning around a newly confirmed restricted cell, and a full
store-driven session that discovers a restriction and still reaches the target.

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
