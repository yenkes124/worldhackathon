/**
 * Exports reference outputs from the TypeScript simulation core so the Python
 * Reactor port (reactor/model) can assert bit-for-bit parity.
 *
 *   npx tsx scripts/export-sim-fixture.ts > reactor/model/tests/fixtures/ts_reference.json
 */
import { buildGrid } from '../src/sim/grid'
import { naiveUnsafePath, planAStar, runLearner } from '../src/sim/planner'
import { mulberry32 } from '../src/sim/rng'
import { RIGHT_HAND_TREMOR, VIM_TARGET_POSITION } from '../src/sim/scenario'

const rng = mulberry32(RIGHT_HAND_TREMOR.seed)
const fixture = {
  seed: RIGHT_HAND_TREMOR.seed,
  target: VIM_TARGET_POSITION,
  entries: RIGHT_HAND_TREMOR.entries,
  grid: buildGrid().map((cell) => [cell.position, cell.type]),
  rngFirst16: Array.from({ length: 16 }, () => rng()),
  aStar: RIGHT_HAND_TREMOR.entries.map((entry) =>
    planAStar(entry, VIM_TARGET_POSITION),
  ),
  naiveUnsafe: RIGHT_HAND_TREMOR.entries.map((entry) =>
    naiveUnsafePath(entry, VIM_TARGET_POSITION),
  ),
  learner: RIGHT_HAND_TREMOR.entries.map((entry) =>
    runLearner(entry, VIM_TARGET_POSITION, RIGHT_HAND_TREMOR.seed),
  ),
}

process.stdout.write(`${JSON.stringify(fixture, null, 2)}\n`)
