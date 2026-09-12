import { Html } from '@react-three/drei'
import { useState } from 'react'
import { CELL_META } from '../../sim/cellMeta'
import { buildGrid, describeCoord, key, sameCell, toScenePosition } from '../../sim/grid'
import type { Cell, Vec3 } from '../../sim/types'

interface VoxelGridProps {
  entry: Vec3
  target: Vec3
  highlight: Vec3[]
  pathKeys: Set<string>
  onSelectEntry: (position: Vec3) => void
}

const opacityFor = (cell: Cell, onPath: boolean, isHighlighted: boolean) => {
  if (cell.type === 'VIM_TARGET') return 0.95
  if (cell.type === 'ENT') return 0.55
  if (onPath) return 0.5
  if (isHighlighted) return 0.5
  if (CELL_META[cell.type].noGo) return 0.26
  return 0.14
}

export const VoxelGrid = ({
  entry,
  target,
  highlight,
  pathKeys,
  onSelectEntry,
}: VoxelGridProps) => {
  const [hovered, setHovered] = useState<Cell | null>(null)
  const cells = buildGrid().filter((cell) => cell.type !== 'OUTSIDE')

  return (
    <group>
      {cells.map((cell) => {
        const meta = CELL_META[cell.type]
        const onPath = pathKeys.has(key(cell.position))
        const isHighlighted = highlight.some((position) =>
          sameCell(position, cell.position),
        )
        const isEntry = sameCell(cell.position, entry)
        const isTarget = sameCell(cell.position, target)
        const isHovered = hovered ? sameCell(hovered.position, cell.position) : false
        const size = isTarget ? 0.58 : 0.5

        return (
          <group key={key(cell.position)} position={toScenePosition(cell.position)}>
            <mesh
              onPointerOver={(event) => {
                event.stopPropagation()
                setHovered(cell)
              }}
              onPointerOut={() => setHovered(null)}
              onClick={(event) => {
                event.stopPropagation()
                if (cell.type === 'ENT') onSelectEntry(cell.position)
              }}
            >
              <boxGeometry args={[size, size, size]} />
              <meshStandardMaterial
                color={meta.color}
                emissive={meta.color}
                emissiveIntensity={isTarget ? 1.4 : isHovered || onPath ? 0.7 : 0.25}
                transparent
                opacity={
                  isHovered ? 0.8 : opacityFor(cell, onPath, isHighlighted)
                }
                roughness={0.35}
                metalness={0.1}
              />
            </mesh>
            <mesh>
              <boxGeometry args={[size, size, size]} />
              <meshBasicMaterial
                color={meta.color}
                wireframe
                transparent
                opacity={onPath || isTarget || isEntry ? 0.55 : 0.18}
              />
            </mesh>
            {(isTarget || isEntry) && (
              <Html center distanceFactor={9} zIndexRange={[20, 0]}>
                <div
                  className="pointer-events-none -translate-y-8 rounded-full border px-2 py-[2px] text-[10px] font-medium tracking-wide whitespace-nowrap"
                  style={{
                    borderColor: meta.color,
                    color: meta.color,
                    background: 'rgba(5, 7, 15, 0.78)',
                  }}
                >
                  {isTarget ? 'VIM_TARGET' : 'ENTRY'} [{cell.position.join(',')}]
                </div>
              </Html>
            )}
            {isHovered && !isTarget && !isEntry && (
              <Html center distanceFactor={9} zIndexRange={[20, 0]}>
                <div className="pointer-events-none w-44 -translate-y-10 rounded-lg border border-sky-400/30 bg-[rgba(5,7,15,0.92)] p-2 text-left">
                  <p className="text-[11px] font-semibold text-slate-100">
                    {cell.type}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    [{cell.position.join(', ')}] · {describeCoord(cell.position)}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-300">{meta.name}</p>
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}
