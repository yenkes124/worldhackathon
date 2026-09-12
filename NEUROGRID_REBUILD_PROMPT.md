# NeuroGrid on Reactor — from-scratch rebuild prompt

Paste everything below the line into a capable coding agent (or use it as a
checklist yourself). It contains every number, name and rule needed to rebuild
NeuroGrid as a Reactor Runtime model plus a React client, without access to
this repository. Where this repository already exists, the equivalent files
are named in brackets so the agent can copy instead of re-derive.

---

## SYSTEM PROMPT

You are building **NeuroGrid**: a deterministic, educational, clearly fictional
simulation of a probe travelling through a synthetic "brain" voxel world. It is
streamed to a browser through **Reactor** (https://docs.reactor.inc), a
platform that runs a Python model server-side and streams its video output to
a React app over WebRTC, with typed commands going the other way.

### 0. Non-negotiable framing

- **Not medical software.** All anatomy, coordinates, risks and rewards are
  invented for a proof of concept. Every UI and every model description must
  carry the notice:
  `Not medical software. NeuroGrid is a synthetic, educational world-model demo. It uses invented geometry and invented coordinates — no patient data, no anatomical accuracy, and no use for diagnosis, planning, or surgical guidance.`
- **Deterministic.** Same inputs → identical outputs, always. No wall-clock
  randomness anywhere in the simulation.
- **The "model" is not machine learning.** It is a symbolic transition
  function + a risk-weighted A* planner + a seeded rollout "learner" demo.
  Reactor's catalog models (Helios, LingBot World, …) are generative video
  models and **cannot** run this logic; therefore build a **custom Reactor
  Runtime model** (`reactor-runtime` Python package). Do not try to replace the
  simulation with a generative world model — the result is a hallucinated,
  non-anatomical scene with no meaning.

### 1. The symbolic world (port exactly)

[repo: `src/sim/grid.ts`, `src/sim/cellMeta.ts`]

- Grid is **4 × 4 × 4** (64 cells). Position `[x, y, z]`, integers 0..3.
  - `x`: 0 = left/lateral → 3 = right; `y`: 0 = anterior → 3 = posterior;
    `z`: 0 = inferior → 3 = superior.
- Cell types (16):
  `ENT, WM_SAFE, MOT_LEG, MOT_TRUNK, MOT_ARM, MOT_HAND, MOT_FACE, SENS, THAL, VIM_NEAR, VIM_TARGET, IC_AVOID, VENT_AVOID, BRAINSTEM_AVOID, CEREB_NET, OUTSIDE`
- Layout, written per z-layer (superior first), rows by y (anterior first),
  columns by x (left first). `cellTypeAt([x,y,z]) = LAYERS[z][y][x]`; any
  out-of-bounds position is `OUTSIDE`.

```
z=3: [ENT, ENT, OUTSIDE, OUTSIDE]
     [ENT, MOT_HAND, OUTSIDE, OUTSIDE]
     [MOT_FACE, MOT_ARM, OUTSIDE, OUTSIDE]
     [MOT_TRUNK, MOT_LEG, OUTSIDE, OUTSIDE]
z=2: [WM_SAFE, WM_SAFE, OUTSIDE, OUTSIDE]
     [WM_SAFE, WM_SAFE, IC_AVOID, OUTSIDE]
     [WM_SAFE, WM_SAFE, VENT_AVOID, OUTSIDE]
     [SENS, SENS, VENT_AVOID, OUTSIDE]
z=1: [IC_AVOID, WM_SAFE, VENT_AVOID, OUTSIDE]
     [VIM_NEAR, VIM_TARGET, THAL, OUTSIDE]
     [THAL, VIM_NEAR, THAL, OUTSIDE]
     [SENS, THAL, VENT_AVOID, OUTSIDE]
z=0: [WM_SAFE, BRAINSTEM_AVOID, BRAINSTEM_AVOID, OUTSIDE]
     [IC_AVOID, BRAINSTEM_AVOID, BRAINSTEM_AVOID, OUTSIDE]
     [CEREB_NET, CEREB_NET, CEREB_NET, OUTSIDE]
     [CEREB_NET, CEREB_NET, CEREB_NET, OUTSIDE]
```

- Cell metadata `(name, colour, noGo, risk, reward)`:

| type | name | colour | noGo | risk | reward |
|---|---|---|---|---|---|
| ENT | Entry corridor | #22d3ee | no | 0.05 | 0 |
| WM_SAFE | Safe white matter | #64748b | no | 0.1 | 0.05 |
| MOT_LEG | Motor cortex — leg | #f59e0b | yes | 0.85 | -0.6 |
| MOT_TRUNK | Motor cortex — trunk | #f59e0b | yes | 0.85 | -0.6 |
| MOT_ARM | Motor cortex — arm | #fb923c | yes | 0.9 | -0.7 |
| MOT_HAND | Motor cortex — hand | #fbbf24 | yes | 0.95 | -0.8 |
| MOT_FACE | Motor cortex — face | #f59e0b | yes | 0.85 | -0.6 |
| SENS | Sensory territory | #38bdf8 | yes | 0.8 | -0.5 |
| THAL | Thalamic tissue | #a855f7 | no | 0.35 | 0.2 |
| VIM_NEAR | Near-target network | #c084fc | no | 0.3 | 0.45 |
| VIM_TARGET | Tremor-network target | #34ff9b | no | 0.2 | 1 |
| IC_AVOID | Internal-capsule analogue | #ff4d6a | yes | 1 | -1 |
| VENT_AVOID | Ventricle analogue | #f43f5e | yes | 1 | -1 |
| BRAINSTEM_AVOID | Brainstem analogue | #e11d48 | yes | 1 | -1 |
| CEREB_NET | Cerebellar network | #fb7185 | yes | 0.9 | -0.8 |
| OUTSIDE | Outside modelled volume | #1e293b | yes | 1 | -1 |

- Legend order: `ENT, WM_SAFE, THAL, VIM_NEAR, VIM_TARGET, MOT_HAND, MOT_ARM, MOT_LEG, MOT_TRUNK, MOT_FACE, SENS, IC_AVOID, VENT_AVOID, BRAINSTEM_AVOID, CEREB_NET, OUTSIDE`.
- `manhattan(a,b) = |ax-bx|+|ay-by|+|az-bz|`.

### 2. Scenario (exactly)

[repo: `src/sim/scenario.ts`]

- id `right-hand-tremor`, title
  `Right-hand tremor — left hemisphere approach`.
- Target `VIM_TARGET` at **[1, 1, 1]**.
- Entries = all `ENT` cells = **[0,0,3], [1,0,3], [0,1,3]** (default entry:
  the first, [0,0,3]).
- Highlighted context = all `MOT_HAND` cells ([1,1,3]); it is context **and**
  a hard no-go.
- Seed **20240917**.
- Summary: "A synthetic right-hand tremor case. Because the modelled motor
  pathways cross the midline, the simulation works in the left hemisphere and
  highlights the left hand motor context."

### 3. World model, planner, learner (exactly)

[repo: `src/sim/worldModel.ts`, `src/sim/planner.ts`, `src/sim/rng.ts`]

- Actions, in this order:
  `X_NEG (-1,0,0) "Move left"`, `X_POS (+1,0,0) "Move right"`,
  `Y_NEG (0,-1,0) "Move anterior"`, `Y_POS (0,+1,0) "Move posterior"`,
  `Z_NEG (0,0,-1) "Move inferior"`, `Z_POS (0,0,+1) "Move superior"`.
- `predictTransition(from, action)` → `to = from + delta`; `inBounds`;
  `predictedType = cellTypeAt(to)`; `risk/reward` from metadata;
  `allowed = inBounds && !noGo`; rationale strings:
  out of bounds → `Leaves the modelled 4×4×4 volume.`; no-go →
  `Blocked: <name> is a hard no-go constraint.`; else `Permitted: <name>.`
- `legalMoves(from)` = allowed predictions in action order.
- **A\*** (`RISK_WEIGHT = 2`): if start is no-go → empty result. Open set
  starts with start (g=0). Each iteration pick the open node with the lowest
  `g + manhattan(node, target)` (iterate in insertion order, strict `<`, so
  ties go to the earliest inserted). If it is the target, reconstruct the path
  and return `{path, found:true, expanded}`. Otherwise remove it, `expanded += 1`,
  and for each legal move: `tentative = g[current] + 1 + risk*2`; if
  `tentative < g[neighbour]` (default ∞) update cameFrom/g and add to open.
  No closed set. Empty result if the open set drains.
- `evaluatePath(path, target)`: over cells after the first: `steps = len-1`,
  `totalRisk` (3 dp), `peakRisk`, `totalReward` (3 dp), `reachesTarget`,
  `violations` = every path cell whose type is no-go.
- `naiveUnsafePath(start, target)`: walk x to target, then y, then z,
  ignoring constraints (the "failed" route shown in red).
- `explainFailure`: "Rejected at [x, y, z]: <name> and N further no-go
  cell(s). <description>".
- **RNG**: mulberry32 (32-bit):
  `state = (state + 0x6d2b79f5) >>> 0; t = imul(t ^ (t>>>15), t|1); t ^= t + imul(t ^ (t>>>7), t|61); return ((t ^ (t>>>14)) >>> 0) / 4294967296`.
- **Learner** (`episodes = 240`, `maxSteps = 24`): per episode
  `explore = max(0.05, 0.65*(1 - episode/episodes))`; from start, keep a
  `seen` set; each step: stop if at target; options = legal moves not seen;
  stop if none; score each `reward*2 - risk - manhattan(to,target)*0.5`, sort
  descending (stable); `chosen = random() < explore ? scored[floor(random()*len)] : scored[0]`
  (note: two RNG draws only when exploring); accumulate
  `score += reward - risk*0.5`. Episode score = reached ? `score + 5 - len(path)*0.1` : `score - 5`
  (3 dp). Keep the best reached path. Result includes `episodeScores`.
- Expected checks (from the reference implementation's tests): A* from
  [0,0,3] reaches [1,1,1] with no violations; the naive path from [0,0,3]
  passes through at least one no-go cell; learner with seed 20240917 finds a
  violation-free path; all results are bit-identical across runs.

### 4. Body-reaction layer (exactly)

[repo: `src/sim/reactions.ts`] Severity: non-no-go → `none` for ENT else
`mild`; no-go → `critical` if risk ≥ 1 else `severe`. Headline / body per type:

- ENT — "Nothing happens yet": probe rests in a permitted entry corridor; no response.
- WM_SAFE — "Quiet passage": no motor/sensory change, small accumulated risk.
- MOT_HAND — "Right hand twitches — no-go": synthetic right hand jerks, tremor worsens.
- MOT_ARM — "Right arm jerks — no-go". MOT_LEG — "Right leg kicks — no-go".
- MOT_TRUNK — "Trunk stiffens — no-go". MOT_FACE — "Face grimaces — no-go" (grimace, slurred speech).
- SENS — "Tingling in the right side — no-go".
- THAL — "Faint tremor change". VIM_NEAR — "Tremor eases". VIM_TARGET — "Tremor stops" (success).
- IC_AVOID — "Right side goes weak — critical". VENT_AVOID — "Fluid breach — critical".
- BRAINSTEM_AVOID — "Breathing falters — critical". CEREB_NET — "Balance lost — no-go".
- OUTSIDE — "Outside the modelled volume".

### 5. Reactor Runtime model (Python)

[repo: `reactor/model/model.py`, `reactor/model/neurogrid/*`, `reactor.yaml`]

- Package: `reactor-runtime==3.2.7` (needs Python 3.12; install inside Docker —
  it fails to build on some hosts). Deps: `numpy`, `Pillow`, `PyYAML`; system
  package `fonts-dejavu-core`.
- Workspace `reactor.yaml` (`$schema: reactor/v2`): model name `neurogrid`,
  `runtime.import: model:NeuroGridModel`, `runtime.config: config.yaml`
  (`width: 960`, `height: 600`), `build.runtime_version: "3.2.7"`,
  `python_requirements: requirements.txt`, `system_packages: [fonts-dejavu-core]`.
- Class `NeuroGridModel(ReactorModel)`, `fps = 12`, output class
  `NeuroGridOutput(Output)` with one field `main_video: Video`.
- Lifecycle: `load(config_path)` creates renderer, session, camera;
  `@session_started` resets them; `@connected` sends `ScenarioInfo`,
  `SimulationState`, `CameraState` to the joining client.
- Messages (`ModelMessage`): `SimulationState{state: dict}` (JSON mirror of the
  store: entry, mode `astar|learner`, plan {path, found, expanded, evaluation},
  failedPath, showFailed, stepIndex, currentPosition, currentType, isRunning,
  hasStarted, bodyReaction), `ScenarioInfo{scenario, highlight_context,
  legend, grid, step_interval_ms=900, safety_notice}`,
  `CameraState{yaw,pitch,zoom}`, `HoverInfo{position?,type?}`.
- Commands (`@event`): `start`, `run`, `pause`, `step`, `reset`,
  `set_entry(position:[x,y,z] — must be an ENT cell, else CommandError)`,
  `set_mode(mode: "astar"|"learner")`, `toggle_failed`, `get_state`,
  `get_scenario`, `orbit(yaw_delta, pitch_delta, zoom_scale)`, `reset_camera`,
  `hover(x,y in 0..1)`, `click(x,y in 0..1 — clicking an ENT voxel sets the entry)`.
  Do **not** use mutable defaults (lists) for event parameters — the runtime
  rejects them; use `None` and validate.
- `run()` loop: wait for `connected`; every tick, if running and
  `900 ms` elapsed, advance `stepIndex` along the plan and send a
  `SimulationState`; re-render only when dirty; `await self.emit(NeuroGridOutput(main_video=frame))`
  then `await asyncio.sleep(0)`.
- Renderer: pure NumPy/Pillow isometric voxel view of the 4×4×4 grid — cells
  as shaded cubes in their legend colour (OUTSIDE not drawn), the planned path
  as a bright polyline, the failed path in red when shown, the probe as a
  white sphere, the target with an emerald halo, MOT_HAND with an amber
  outline, the hovered voxel with a white outline; a header with scenario
  title and the safety notice. Frame = RGB uint8 array (H, W, 3).
- Local run: `reactor build` then `reactor run` (Docker, port 8080). Smoke
  test with the Python SDK (`reactor-sdk`): `Reactor(model_name="neurogrid", local=True, api_url=...)`,
  on READY subscribe to the recvonly video track and to messages, send
  `start → step → run → set_entry → set_mode learner → toggle_failed`, assert
  frames of shape (600, 960, 3) and `SimulationState` messages arrive.

### 6. Hosting — the one hard requirement: **inbound UDP**

Reactor streams video over WebRTC. The host of the Runtime container must
either accept **inbound UDP** (any VPS, Fly.io with a dedicated IPv4 and a
UDP service on the WebRTC port range, a home box with port-forwarding) or you
must supply a **TURN relay** on such a host. Verified facts:

- Reactor's own hosting (`reactor model deploy`) requires **"serve access"**
  on the account (otherwise `403: serve access is not enabled for this account`).
- **Modal does not work** for the media path: no inbound UDP, no UDP tunnel
  (its `modal.forward` is TCP-only); even coturn inside the container over a
  TCP tunnel did not yield a live stream. HTTP signalling works, video never
  starts. Do not spend time there.
- Runtime env vars: `HOST`, `PORT` (8080), `STUN_SERVERS`,
  `TURN_SERVERS` (`username;credential;turn:host:3478?transport=tcp`, comma
  separated), `ICE_TRANSPORT_POLICY` (`all|relay`), `WEBRTC_PORT_RANGE`
  (`min:max`, e.g. `50000:50019`). `/ice_servers` returns what browsers get.
- Working Docker recipe: `python:3.12-slim`, apt `fonts-dejavu-core`,
  `pip install reactor-runtime==3.2.7 numpy Pillow PyYAML`, copy the model to
  `/app`, `CMD python -m reactor_runtime.serve`, expose `8080/tcp` and
  `50000-50019/udp`, env `STUN_SERVERS=stun:stun.l.google.com:19302`,
  `WEBRTC_PORT_RANGE=50000:50019`, `ICE_TRANSPORT_POLICY=all`.
- Fly.io specifics: `[http_service] internal_port=8080`; a `[[services]]`
  UDP block with ports 50000–50019; `fly ips allocate-v4` (dedicated IPv4 is
  required for UDP); UDP replies must come from the `fly-global-services`
  address — if ICE fails, bind the Runtime's UDP to that address.

### 7. React client

[repo: `reactor/client/`] Vite + React 19 + `@reactor-team/js-sdk`.

- `<ReactorProvider modelName="neurogrid" local apiUrl={import.meta.env.VITE_REACTOR_API_URL}>`
  for a self-hosted Runtime (`apiUrl` = the container's public https URL); or
  `modelName="<org>/neurogrid"` + a server-side token route when hosted by
  Reactor (the API key must never reach the browser).
- `<ReactorView>` fills the centre. Panels: intro overlay (must be dismissed
  → sends `start`), permanent safety banner, controls (Run/Pause/Step/Reset,
  entry selector, A*/learner toggle, "show unsafe route"), prediction panel
  (six actions with allowed/blocked + rationale for the current cell), metrics
  (steps, total/peak risk, reward, expansions/episodes), legend, body-reaction
  card (headline + body + severity colour), all driven by `SimulationState`.
- Drag on the video → `orbit`; move → `hover`; click → `click`.
- Vite gotchas: exclude `@reactor-team/js-sdk` from `optimizeDeps` and include
  its nested `awaitqueue`, or the WASM fails to load; drop React `StrictMode`
  in dev (double-mount breaks the connection).
- Keys/tokens: a Reactor JWT is session-scoped — mint once, cache until near
  expiry, reuse for all requests of that session.

### 8. Definition of done

1. `pytest` parity suite passes (A* path, expansions, learner episode scores
   identical between reference and port).
2. `reactor run` locally + smoke test receives frames and state messages.
3. Deployed on a UDP-capable host; browser shows the streamed grid, Run/Step
   move the probe along the A* path from [0,0,3] to [1,1,1], the reaction card
   shows "Tremor stops" at the target, switching entry/mode replans, the
   unsafe route toggles on in red with its rejection reason.
4. Safety notice visible in the UI, the model description and the README.
