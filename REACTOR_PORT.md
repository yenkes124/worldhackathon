# Porting NeuroGrid to Reactor

> **Not medical software.** NeuroGrid is a synthetic, educational simulation.
> The anatomy, the coordinates and the risk/reward numbers are invented. Nothing
> in this document or in `reactor/` changes that framing.

## 1. What Reactor is

[Reactor](https://docs.reactor.inc/overview) is a platform for **real-time,
interactive video models**. A model runs in a container on Reactor's
infrastructure, streams video frames to a browser over **WebRTC**, and receives
typed **commands** back from the browser over a data channel, all inside a
per-user **session** that Reactor manages (auth, lifecycle, transport, frame
pacing). It is not a 3D engine or a UI framework: the only visual primitive it
knows is a video track carrying RGB frames.

**Pieces and languages**

| Piece | Language | Role |
| --- | --- | --- |
| Reactor Runtime (`reactor-runtime`, PyPI) | Python | Open-source host for a model: `ReactorModel` subclass with `load()` / `run()`, `@event` commands, `ModelMessage` outbound messages, `Output` tracks (`Video`, audio). Serves HTTP + WebRTC on port 8080. |
| Reactor CLI (`reactor`) | Python | `reactor build` (Docker image), `reactor run` (local), `reactor model deploy` (hosted). Config in `reactor.yaml`. |
| JS/React SDK (`@reactor-team/js-sdk`) | TypeScript | `ReactorProvider`, `ReactorView` (renders a track into a `<video>`), `useReactor` (status, `sendCommand`), `useReactorMessage` (model messages). Works against hosted models (JWT) and a self-hosted Runtime (`local` + `apiUrl`). |
| Python SDK (`reactor-sdk`) | Python | Same client protocol from Python; used here for headless smoke tests. |
| REST API (`api.reactor.inc`) | — | `POST /tokens`: exchange an API key (server-side) for a short-lived JWT scoped to a model. |

**Catalog models.** Reactor also hosts ready-made models you can connect to
without deploying anything: Helios, LingBot / LingBot World 2, X2, FastH3,
HappyOyster, LongLive-2.0, SANA-Streaming, Visko Orbis Stable, LTX. They are
all **generative video / world models**: they take a prompt, image or control
input and hallucinate the next frames in real time. Their intended use cases
are interactive video generation, playable "world" demos, avatar/character
streams and similar creative real-time experiences.

## 2. Which Reactor primitive fits NeuroGrid

**NeuroGrid's "model" is not a trained ML model.** It is a *symbolic* world
model:

- a fixed 4×4×4 labelled grid (`grid.ts`, `cellMeta.ts`) — a lookup table;
- a deterministic transition function `predict(cell, action)` → next cell,
  tissue label, risk, reward (`worldModel.ts`);
- a risk-weighted A* planner with hard no-go constraints (`planner.ts`);
- a seeded rollout learner on a mulberry32 PRNG (`planner.ts`, `rng.ts`).

Given identical inputs it produces identical outputs, bit for bit. No catalog
model can host that: a generative video model cannot be asked to *execute* an
A* search, and would not be reproducible if it could. Swapping NeuroGrid's
planner for Helios or LingBot would replace the point of the demo (a planner
reasoning against a world model) with a hallucination of it.

**Recommendation: a custom Reactor Runtime model.** The mapping is direct:

| NeuroGrid concept (original) | Reactor concept (port) |
| --- | --- |
| `src/sim/*` pure functions | Python package `reactor/model/neurogrid/` — same functions, same numbers |
| zustand store + actions (`simulationStore.ts`) | `SimulationSession` inside the `ReactorModel`; every store action is an `@event` command (`start`, `run`, `pause`, `step`, `reset`, `set_entry`, `set_mode`, `toggle_failed`, `get_state`, `get_scenario`) |
| Store state read by UI panels | `SimulationState` `ModelMessage` (JSON mirror of the store), pushed on every change and returned by `get_state` |
| Scenario / legend / grid constants | `ScenarioInfo` `ModelMessage`, pushed on connect and returned by `get_scenario` |
| 900 ms `setInterval` tick in Run mode | 900 ms tick inside the model's `run()` loop (`STEP_INTERVAL_MS = 900`) |
| react-three-fiber scene | **Server-side software renderer** (`render.py`, NumPy + Pillow) drawing an orbitable isometric voxel view into the `main_video` `Output` track at 960×600 |
| OrbitControls drag / wheel | `orbit` / `reset_camera` commands; the client forwards pointer drags and wheel deltas |
| Hover / click on voxels | `hover` / `click` commands with normalised `(u, v)`; the model picks the voxel and replies with `HoverInfo` / applies `set_entry` |
| React UI panels | Unchanged idea, rebuilt in `reactor/client/` around `ReactorProvider` + `ReactorView` |

"Weights" in Reactor terms are simply absent: `reactor.yaml` declares no
artifacts, `load()` builds the grid and scenario, `run()` ticks the session and
renders frames.

## 3. Architecture of the port

```
reactor/
├── model/                      Reactor Runtime model (Python)
│   ├── reactor.yaml            model spec: import model:NeuroGridModel, runtime 3.2.7
│   ├── config.yaml             frame size of the rendered video track
│   ├── model.py                NeuroGridModel: events, messages, video output, tick loop
│   ├── neurogrid/              port of src/sim (types, grid, cell_meta, scenario,
│   │                           world_model, planner, rng) + session.py + render.py
│   └── tests/
│       ├── test_simulation.py  18 pytest tests (12 behaviour + 6 bit-exact parity)
│       ├── fixtures/ts_reference.json   generated from the TS code by
│       │                                scripts/export-sim-fixture.ts
│       └── smoke_local.py      headless Python-SDK smoke test against a Runtime
├── client/                     React 19 + Vite client using @reactor-team/js-sdk
│   ├── src/App.tsx             ReactorProvider (local or hosted), layout
│   ├── src/components/         SafetyBanner, IntroOverlay, SceneView (ReactorView +
│   │                           orbit/hover/click forwarding), Control/Prediction/
│   │                           Metrics/Legend panels, ConnectionBadge
│   ├── src/reactor/            useCommands (sendCommand wrappers), message types
│   ├── src/state/store.ts      zustand mirror of the model's messages
│   └── server/token.mjs        server-side API-key → JWT exchange (hosted mode)
└── modal_app.py                optional self-hosting of the Runtime on Modal
```

**Data flow.** Browser → `sendCommand("step")` → Runtime → `@event step` →
`SimulationSession.step()` → `SimulationState` message → zustand mirror →
panels re-render. In parallel, `run()` renders the current `SceneState` every
frame into `main_video` → WebRTC → `<ReactorView>`.

**Determinism is preserved.** `reactor/model/neurogrid/` keeps the exact grid
layout, coordinate convention (x: left→right, y: anterior→posterior,
z: inferior→superior), cell metadata values, action ordering, A* cost
(`1 + risk × 2`), learner scoring and mulberry32 arithmetic. The parity tests
compare A* paths, expansion counts, the unsafe direct route, path evaluation and
all 240 learner episode scores against a fixture exported from the TypeScript
implementation. The only intentional divergence is the Python attribute
`from_` (a reserved word), serialised back as `"from"`.

**Safety framing.** The intro overlay, the persistent banner ("Not medical
software…"), the `safety_notice` field in `ScenarioInfo`, the caption burned
into every rendered frame and every module docstring carry the same
disclaimer. The scenario is the same right-hand-tremor case: `VIM_TARGET` at
`[1, 1, 1]`, entry corridors `[0,0,3]`, `[1,0,3]`, `[0,1,3]`, `MOT_HAND` as
highlighted context and hard no-go, seed `20240917`, 240 learner episodes.

## 4. Limitations and trade-offs

- **No native 3D.** Reactor streams video; it does not host WebGL/Three.js.
  The brain grid is therefore rendered on the server as an orbitable isometric
  voxel view. Orbit, zoom, hover and click round-trip through commands, so they
  have network latency instead of being local. The translucent procedural brain
  shell of the original is replaced by a lighter voxel-only rendering with
  axes, labels and the trajectory lines.
- **Custom-model hosting is an account entitlement.** `reactor model deploy`
  on the provided account returned `403: serve access is not enabled for this
  account`. The CLI authenticated fine; the dashboard shows no self-service
  switch. This is not an API-key scope — Reactor has to enable it. Until then
  the model runs on any host that can run the Runtime container.
- **Runtime version.** The model pins `runtime_version: "3.2.7"`; installing
  the Runtime directly on the host Python failed on GTK/cairo build deps, so the
  supported workflow is the CLI's Docker path (`reactor build` / `reactor run`).
- **Every Reactor deploy reserves a GPU** even though NeuroGrid is CPU-only
  (NumPy). `reactor.yaml` requests the smallest type.
- **SDK warning.** The Python SDK logs `unparseable data message … Protobuf`
  once per session against Runtime 3.2.7; commands, replies and frames still
  work. Not yet root-caused.

## 5. How to run it

**Local Runtime + client (verified end-to-end):**

```sh
cd reactor/model && reactor run            # Docker; serves http://localhost:8080
cd reactor/client && cp .env.example .env && npm ci && npm run dev
```

Open the Vite URL: intro → *Enter the simulation* → Step / Run / Pause /
Reset, entry selection, A* vs Learner, unsafe route, drag to orbit.

**Headless check:** `cd reactor/model && python tests/smoke_local.py` (Python
SDK; receives frames of shape `(600, 960, 3)` and state messages).

**Hosted (once serve access is enabled):** `cd reactor/model && reactor model
deploy`, then in the client `VITE_REACTOR_LOCAL=false`,
`VITE_REACTOR_MODEL=<account>/neurogrid`, and `REACTOR_API_KEY` **server-side
only** — `server/token.mjs` exchanges it for a JWT scoped to that model; the
key never reaches the browser.

**Self-hosting on Modal (`reactor/modal_app.py`).** `modal deploy
reactor/modal_app.py` builds the same Runtime image and exposes its HTTP API
behind a Modal `web_server` endpoint; the client points at it with
`VITE_REACTOR_API_URL=https://<workspace>--neurogrid-reactor-runtime-runtime-serve.modal.run`
in local mode. Status: the endpoint is healthy (`/health` → `available`) and
sessions start, but **media does not connect without a TURN relay** — Modal
containers have outbound UDP only, so the browser can never reach the
container's ICE candidates directly. Provide TURN credentials via the
`neurogrid-turn` Modal secret (`TURN_SERVERS=user;cred;turn:host:3478?transport=tcp`);
public free relays proved unreliable. Any container host with a public UDP
port (Fly.io, a VM) avoids the TURN requirement entirely.

**Self-hosting on Fly.io (direct UDP, no TURN).** `reactor/fly/` contains a
standalone Dockerfile and `fly.toml` for the Runtime with HTTP on port 8080
and a `50000:50019` UDP service range for WebRTC. Fly requires a dedicated
IPv4 for public UDP and normally requires UDP sockets to bind to
`fly-global-services`; the current Runtime binds `0.0.0.0`, so verify that
binding before deployment. STUN is configured to advertise Fly's public
server-reflexive candidate, avoiding a TURN relay.

## 6. Closest alternative if Reactor is not wanted

The original React/Three.js app remains the best fit for a client-side
deterministic simulation: no server, no video latency, true 3D. The Reactor
port earns its cost only when the *server-side* model is the product — e.g. a
heavier planner, a shared multi-user session, or a future swap-in of a learned
transition model — and even then the symbolic planner should stay in the
Runtime model, not a catalog model.

## Update: hosted generated-brain explorer (option A — active path)

Custom-model hosting on Reactor is currently gated: the account receives
`403: serve access is not enabled for this account`. Modal self-hosting also
needs a TURN relay for browser media. The chosen path is therefore a
Reactor-hosted catalog world model instead; the earlier Runtime/Modal sections
remain **option B (kept in the repo under `reactor/`)**.

The explorer starts `reactor/lingbot-world-2` with the fictional, generated
`public/brain-seed.jpg` and a scene prompt. It sends commands in this order:
`set_image` → `set_prompt` → `set_seed` (`20240917`) → `start`. The model's
`main_video` is rendered through `<ReactorView>`. Keyboard controls map to
`set_move_longitudinal` (W/S), `set_move_lateral` (A/D),
`set_look_horizontal` (←/→), `set_look_vertical` (↑/↓), and
`set_camera_pose` (Q/E, layer up/down). The implementation lives in
`src/explore/{BrainExplorer.tsx,useWorldSession.ts,explorerStore.ts,navigation.ts,MiniMap.tsx,ReactionPanel.tsx}`,
`src/sim/reactions.ts`, and `server/token.mjs` (Vite middleware in development,
`server/serve.mjs` in production).

The world model exposes no coordinates, so the explorer dead-reckons its
position on the 4×4×4 grid only from confirmed
`chunk_complete.active_action` events: `CELL_PER_CHUNK = 0.1` cells,
`YAW_PER_CHUNK = 15°`, and `CLIMB_PER_CHUNK = 0.2`. `OUTSIDE` cells act as
walls. The TypeScript simulation (`grid` / `cellMeta` / `planner`) remains
authoritative for the region, body reaction, and A* hint. This is deterministic
for a given action sequence, but it is **not anatomical registration**; the
generated scenery is non-repeatable in detail even with a seed.

The server keeps `REACTOR_API_KEY` private and exchanges it at
`POST https://api.reactor.inc/tokens` for a session-scoped JWT:

```json
{
  "authorization_details": [
    {
      "type": "session",
      "resources": {
        "models": { "match": ["reactor/lingbot-world-2"] }
      }
    }
  ]
}
```

The browser caches that JWT until near `expires_at`. A session-scoped token
only authorises sessions it created, so re-minting a token per request results
in `403`.

This path is usage-billed (about `$25/hr` while streaming), subject to an
account concurrent-session quota of 5, and can occasionally return `429: no
available capacity` from the platform. If that happens, try again.
