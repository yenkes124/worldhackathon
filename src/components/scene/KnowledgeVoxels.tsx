import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import type { Mesh } from 'three'
import { knowledgeKey, sameKnowledgeCell } from '../../sim/agentKnowledge'
// Only the coordinate-to-scene mapping comes from the grid module; cell labels
// are never read here, so the scene can show no more than the agent knows.
import { toScenePosition } from '../../sim/grid'
import type { CheckVerdict } from '../../sim/knowledgeView'
import { KNOWLEDGE_VIEW } from '../../sim/knowledgeView'
import type { KnowledgeCell, KnowledgeMap, Vec3 } from '../../sim/types'

interface KnowledgeVoxelsProps {
  knowledge: KnowledgeMap
  entry: Vec3
  probe: Vec3
  checkedCell: Vec3 | null
  verdict: CheckVerdict
  onSelectEntry: (position: Vec3) => void
}

const VERDICT_STYLE: Record<CheckVerdict, { color: string; text: string }> = {
  pending: { color: '#fbbf24', text: 'CHECKING' },
  passed: { color: '#34d399', text: 'PASSED' },
  rejected: { color: '#ff4d6a', text: 'REJECTED' },
}

/** Slowly breathing outline around the cell the safety check is about to test. */
const PulseCage = ({ color }: { color: string }) => {
  const mesh = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!mesh.current) return
    const scale = 1 + Math.sin(clock.elapsedTime * 4) * 0.12
    mesh.current.scale.setScalar(scale)
  })
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[0.26, 12, 12]} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.95} />
    </mesh>
  )
}

/**
 * Renders the 4x4x4 volume as the exploring agent believes it to be: cells the
 * simulated safety check has not revealed stay uniformly grey, so the scene
 * never shows more than the knowledge map holds.
 */
export const KnowledgeVoxels = ({
  knowledge,
  entry,
  probe,
  checkedCell,
  verdict,
  onSelectEntry,
}: KnowledgeVoxelsProps) => {
  const [hovered, setHovered] = useState<KnowledgeCell | null>(null)
  const cells = Object.values(knowledge)
  const verdictStyle = VERDICT_STYLE[verdict]

  return (
    <group>
      {cells.map((belief) => {
        const cell = belief
        const status = belief.status
        const view = KNOWLEDGE_VIEW[status]
        const isChecked = checkedCell
          ? sameKnowledgeCell(checkedCell, cell.position)
          : false
        const isProbe = sameKnowledgeCell(probe, cell.position)
        const isHovered = hovered
          ? sameKnowledgeCell(hovered.position, cell.position)
          : false
        const radius =
          status === 'KNOWN_TARGET'
            ? 0.16
            : isHovered || isChecked || isProbe
              ? 0.13
              : status === 'UNKNOWN'
                ? 0.09
                : 0.11

        return (
          <group
            key={knowledgeKey(cell.position)}
            position={toScenePosition(cell.position)}
          >
            <mesh
              onPointerOver={(event) => {
                event.stopPropagation()
                setHovered(cell)
              }}
              onPointerOut={() => setHovered(null)}
              onClick={(event) => {
                event.stopPropagation()
                if (status === 'KNOWN_ENTRY') onSelectEntry(cell.position)
              }}
            >
              <sphereGeometry args={[radius, 20, 20]} />
              <meshStandardMaterial
                color={view.color}
                emissive={view.color}
                emissiveIntensity={
                  status === 'KNOWN_TARGET'
                    ? 1.8
                    : isHovered || isChecked
                      ? 1.2
                      : status === 'UNKNOWN'
                        ? 0.15
                        : 0.8
                }
                transparent
                opacity={
                  isHovered
                    ? Math.max(view.opacity, 0.75)
                    : Math.min(1, view.opacity + 0.2)
                }
                roughness={0.35}
                metalness={0.1}
              />
            </mesh>
            {status !== 'UNKNOWN' && (
              <mesh>
                <sphereGeometry args={[radius * 1.7, 16, 16]} />
                <meshBasicMaterial
                  color={view.color}
                  transparent
                  opacity={status === 'KNOWN_TARGET' ? 0.28 : 0.14}
                  depthWrite={false}
                />
              </mesh>
            )}

            {isChecked && <PulseCage color={verdictStyle.color} />}

            {(isChecked ||
              status === 'KNOWN_TARGET' ||
              (status === 'KNOWN_ENTRY' &&
                sameKnowledgeCell(cell.position, entry)) ||
              status === 'CONFIRMED_NO_GO') && (
              <Html center distanceFactor={9} zIndexRange={[20, 0]}>
                <div
                  className="pointer-events-none -translate-y-8 rounded-full border px-2 py-[2px] text-[10px] font-semibold tracking-wide whitespace-nowrap"
                  style={{
                    borderColor: isChecked ? verdictStyle.color : view.color,
                    color: isChecked ? verdictStyle.color : view.color,
                    background: 'rgba(5, 7, 15, 0.82)',
                  }}
                >
                  {isChecked
                    ? verdictStyle.text
                    : status === 'CONFIRMED_NO_GO'
                      ? 'RESTRICTED'
                      : status === 'KNOWN_TARGET'
                        ? 'TARGET'
                        : 'ENTRY'}{' '}
                  [{cell.position.join(',')}]
                </div>
              </Html>
            )}

            {isHovered && !isChecked && (
              <Html center distanceFactor={9} zIndexRange={[20, 0]}>
                <div className="pointer-events-none w-44 -translate-y-10 rounded-lg border border-sky-400/30 bg-[rgba(5,7,15,0.92)] p-2 text-left">
                  <p className="text-[11px] font-semibold text-slate-100">
                    {view.label}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    [{cell.position.join(', ')}]
                    {isProbe ? ' · probe is here' : ''}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-300">
                    {belief.observedLabel
                      ? `Observed as ${belief.observedLabel} · confidence ${belief.confidence}%`
                      : 'Never checked, so the agent knows nothing about it.'}
                  </p>
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}
