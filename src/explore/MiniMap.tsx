import { Map } from 'lucide-react'
import { Panel } from '../components/ui/Panel'
import { CELL_META } from '../sim/cellMeta'
import { GRID_SIZE, cellTypeAt, key } from '../sim/grid'
import type { Vec3 } from '../sim/types'
import { EXPLORER_TARGET, useExplorer } from './explorerStore'

const CELL = 44
const PAD = 6
const SIZE = GRID_SIZE * CELL + PAD * 2

/** Top-down slice of the symbolic grid at the explorer's current layer. */
export const MiniMap = () => {
  const nav = useExplorer((s) => s.nav)
  const cell = useExplorer((s) => s.cell)
  const visited = useExplorer((s) => s.visited)
  const z = cell[2]
  const seen = new Set(visited.filter((v) => v.cell[2] === z).map((v) => key(v.cell)))

  const px = PAD + (nav.position[0] + 0.5) * CELL
  const py = PAD + (nav.position[1] + 0.5) * CELL
  const theta = (nav.heading * Math.PI) / 180
  const ax = px + Math.sin(theta) * 14
  const ay = py + Math.cos(theta) * 14

  return (
    <Panel title={`Symbolic map · layer z = ${z}`} icon={Map}>
      <div className="flex gap-4">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-[188px] w-[188px] shrink-0"
          role="img"
          aria-label={`Grid layer ${z}, explorer at ${cell.join(', ')}`}
        >
          {Array.from({ length: GRID_SIZE }, (_, y) =>
            Array.from({ length: GRID_SIZE }, (_, x) => {
              const p: Vec3 = [x, y, z]
              const type = cellTypeAt(p)
              const meta = CELL_META[type]
              const isTarget = key(p) === key(EXPLORER_TARGET)
              const outside = type === 'OUTSIDE'
              return (
                <g key={key(p)}>
                  <rect
                    x={PAD + x * CELL + 1}
                    y={PAD + y * CELL + 1}
                    width={CELL - 2}
                    height={CELL - 2}
                    rx={5}
                    fill={outside ? 'transparent' : meta.color}
                    fillOpacity={outside ? 0 : seen.has(key(p)) ? 0.75 : 0.28}
                    stroke={isTarget ? '#34ff9b' : meta.noGo ? '#f87171' : '#334155'}
                    strokeWidth={isTarget ? 2 : 1}
                    strokeDasharray={outside ? '3 3' : undefined}
                  />
                  {!outside && (
                    <text
                      x={PAD + x * CELL + CELL / 2}
                      y={PAD + y * CELL + CELL / 2 + 3}
                      textAnchor="middle"
                      fontSize={7}
                      fill="#e2e8f0"
                      fillOpacity={0.85}
                    >
                      {type.replace('_AVOID', '').replace('_', ' ')}
                    </text>
                  )}
                </g>
              )
            }),
          )}
          <line x1={px} y1={py} x2={ax} y2={ay} stroke="#f8fafc" strokeWidth={2} />
          <circle cx={px} cy={py} r={5} fill="#f8fafc" stroke="#0ea5e9" strokeWidth={2} />
        </svg>
        <div className="flex flex-col justify-between text-[11px] text-slate-400">
          <div>
            <p className="text-[10px] tracking-wide text-slate-500 uppercase">Axes</p>
            <p className="mt-1">→ x: left … right</p>
            <p>↓ y: anterior … posterior</p>
            <p>z: layer {z} of 0–3 (Q up / E down)</p>
          </div>
          <div>
            <p className="text-[10px] tracking-wide text-slate-500 uppercase">Layers</p>
            <div className="mt-1 flex gap-1">
              {[3, 2, 1, 0].map((layer) => (
                <span
                  key={layer}
                  className={`grid h-6 w-6 place-items-center rounded border font-mono text-[10px] ${
                    layer === z
                      ? 'border-sky-400 bg-sky-400/20 text-sky-100'
                      : 'border-slate-700 text-slate-500'
                  }`}
                >
                  {layer}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  )
}
