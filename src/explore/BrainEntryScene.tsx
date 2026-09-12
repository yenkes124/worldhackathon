import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useBrainGeometry } from '../components/scene/BrainShell'
import { CELL_META } from '../sim/cellMeta'
import { cellsOfType, describeCoord, key, sameCell, toScenePosition } from '../sim/grid'
import { RIGHT_HAND_TREMOR } from '../sim/scenario'
import type { CellType, Vec3 } from '../sim/types'

/** Radius the exterior markers are pushed out to so they sit on the shell. */
const SURFACE_RADIUS = 3.05

interface Region {
  label: string
  blurb: string
  color: string
  types: CellType[]
}

const REGIONS: Region[] = [
  {
    label: 'Motor cortex',
    blurb: 'Controls voluntary movement · no-go',
    color: '#3b82f6',
    types: ['MOT_HAND', 'MOT_ARM', 'MOT_LEG', 'MOT_TRUNK', 'MOT_FACE'],
  },
  {
    label: 'Thalamus (VIM)',
    blurb: 'Key target for tremor control',
    color: '#f59e0b',
    types: ['VIM_TARGET', 'VIM_NEAR', 'THAL'],
  },
  {
    label: 'Sensory cortex',
    blurb: 'Touch and position sense · no-go',
    color: '#38bdf8',
    types: ['SENS'],
  },
  {
    label: 'Internal capsule',
    blurb: 'Dense fibre bundle · no-go',
    color: '#ef4444',
    types: ['IC_AVOID'],
  },
  {
    label: 'Cerebellum',
    blurb: 'Coordinates movement and balance',
    color: '#14b8a6',
    types: ['CEREB_NET'],
  },
  {
    label: 'Brainstem',
    blurb: 'Critical inferior structure · no-go',
    color: '#a855f7',
    types: ['BRAINSTEM_AVOID'],
  },
]

const onSurface = (cells: Vec3[]): [number, number, number] => {
  const centroid = new THREE.Vector3()
  for (const cell of cells) centroid.add(new THREE.Vector3(...toScenePosition(cell)))
  centroid.divideScalar(Math.max(1, cells.length))
  const out = centroid.clone().normalize().multiplyScalar(SURFACE_RADIUS)
  // Match the shell's squash / stretch so markers hug the mesh.
  out.y *= 0.82
  out.z *= 1.12
  return [out.x, out.y, out.z]
}

const RegionMarkers = () => {
  const markers = useMemo(
    () =>
      REGIONS.map((region) => ({
        ...region,
        position: onSurface(region.types.flatMap((type) => cellsOfType(type))),
      })),
    [],
  )
  return (
    <>
      {markers.map((m) => (
        <group key={m.label} position={m.position}>
          <mesh>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial color={m.color} emissive={m.color} emissiveIntensity={1.2} />
          </mesh>
          <Html
            center
            distanceFactor={10}
            zIndexRange={[10, 0]}
            occlude
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="pointer-events-none -translate-y-7 rounded-md border px-2 py-1 text-left whitespace-nowrap"
              style={{
                borderColor: m.color,
                background: 'rgba(5, 7, 15, 0.82)',
              }}
            >
              <p className="text-[10.5px] font-semibold" style={{ color: m.color }}>
                {m.label}
              </p>
              <p className="text-[9px] text-slate-300">{m.blurb}</p>
            </div>
          </Html>
        </group>
      ))}
    </>
  )
}

interface EntrySpotsProps {
  selected: Vec3
  onSelect: (entry: Vec3) => void
}

const EntrySpots = ({ selected, onSelect }: EntrySpotsProps) => {
  const [hovered, setHovered] = useState<string | null>(null)
  const meta = CELL_META.ENT
  return (
    <>
      {RIGHT_HAND_TREMOR.entries.map((cell) => {
        const id = key(cell)
        const isSelected = sameCell(cell, selected)
        const isHovered = hovered === id
        const radius = isSelected || isHovered ? 0.17 : 0.13
        return (
          <group key={id} position={onSurface([cell])}>
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation()
                setHovered(id)
                document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                setHovered(null)
                document.body.style.cursor = ''
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(cell)
              }}
            >
              <sphereGeometry args={[radius, 20, 20]} />
              <meshStandardMaterial
                color={meta.color}
                emissive={meta.color}
                emissiveIntensity={isSelected || isHovered ? 2 : 1}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[radius * 2.2, 16, 16]} />
              <meshBasicMaterial color={meta.color} transparent opacity={0.18} depthWrite={false} />
            </mesh>
            {(isHovered || isSelected) && (
              <Html
                center
                distanceFactor={10}
                zIndexRange={[20, 0]}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className="pointer-events-none w-44 -translate-y-12 rounded-lg border p-2 text-left"
                  style={{
                    borderColor: meta.color,
                    background: 'rgba(5, 7, 15, 0.92)',
                  }}
                >
                  <p className="text-[11px] font-semibold text-cyan-200">
                    Entry point [{cell.join(', ')}]
                  </p>
                  <p className="text-[10px] text-slate-400">{describeCoord(cell)}</p>
                  <p className="mt-1 text-[10px] text-slate-200">
                    {isSelected ? 'Click again to dive in' : 'Click to select'}
                  </p>
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </>
  )
}

/** Flies the camera into the chosen entry point while the hosted world spins up. */
const DiveCamera = ({ target }: { target: [number, number, number] }) => {
  const { camera } = useThree()
  const goal = useMemo(() => new THREE.Vector3(...target), [target])
  const look = useMemo(() => new THREE.Vector3(...target).multiplyScalar(0.2), [target])
  useFrame((_, delta) => {
    camera.position.lerp(goal, Math.min(1, delta * 0.9))
    camera.lookAt(look)
  })
  // If the dive is aborted (error / cancel) pull the camera back out again.
  useEffect(() => {
    const start = camera.position.clone()
    return () => {
      camera.position.copy(start)
      camera.lookAt(0, 0, 0)
    }
  }, [camera])
  return null
}

/** The BrainShell silhouette rendered solid, so from outside it reads as a brain. */
const OpaqueBrain = () => {
  const geometry = useBrainGeometry(RIGHT_HAND_TREMOR.seed, { detailed: true })
  return (
    <mesh geometry={geometry}>
      <meshPhysicalMaterial
        color="#d9b8ad"
        roughness={0.55}
        metalness={0.02}
        clearcoat={0.35}
        clearcoatRoughness={0.5}
        sheen={0.4}
        sheenColor="#f2c9c0"
      />
    </mesh>
  )
}

interface BrainEntrySceneProps {
  selected: Vec3
  diving: boolean
  onSelect: (entry: Vec3) => void
}

/**
 * Exterior view of the synthetic brain: labelled region markers (invented
 * mapping from the symbolic grid, not anatomy) and clickable ENT spots. Picking
 * a spot sets the explorer's entry cell; the dive then hands over to Reactor.
 */
export const BrainEntryScene = ({ selected, diving, onSelect }: BrainEntrySceneProps) => {
  const diveTarget = useMemo(() => onSurface([selected]), [selected])
  return (
    <Canvas camera={{ position: [4.5, 7.5, 6.5], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#05070f']} />
      <fog attach="fog" args={['#05070f', 12, 26]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 8, 4]} intensity={1.4} color="#fff4e6" />
      <directionalLight position={[-6, -3, -5]} intensity={0.6} color="#9ec5ff" />
      <pointLight position={[0, 4, 0]} intensity={8} distance={12} color="#22d3ee" />

      <OpaqueBrain />
      {!diving && <RegionMarkers />}
      <EntrySpots selected={selected} onSelect={onSelect} />

      {diving ? (
        <DiveCamera target={diveTarget} />
      ) : (
        <OrbitControls enablePan={false} minDistance={5} maxDistance={16} target={[0, 0, 0]} />
      )}
    </Canvas>
  )
}
