import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { toScenePosition } from '../../sim/grid'
import type { Vec3 } from '../../sim/types'

interface ProbeProps {
  path: Vec3[]
  stepIndex: number
}

/** Electrode tip that eases toward the current planned voxel each frame. */
export const Probe = ({ path, stepIndex }: ProbeProps) => {
  const group = useRef<THREE.Group>(null)
  const glow = useRef<THREE.Mesh>(null)

  const targetVector = useMemo(() => {
    const position = path[Math.min(stepIndex, Math.max(path.length - 1, 0))]
    return new THREE.Vector3(...toScenePosition(position ?? [0, 0, 0]))
  }, [path, stepIndex])

  const shaftStart = useMemo(() => {
    const origin = path[0]
    return new THREE.Vector3(...toScenePosition(origin ?? [0, 0, 0])).setY(4.4)
  }, [path])

  useFrame((_, delta) => {
    if (!group.current) return
    group.current.position.lerp(targetVector, Math.min(1, delta * 6))
    if (glow.current) {
      const scale = 1 + Math.sin(performance.now() / 320) * 0.08
      glow.current.scale.setScalar(scale)
    }
  })

  if (path.length === 0) return null

  const shaftHeight = Math.max(shaftStart.y - targetVector.y, 0.1)

  return (
    <group>
      <mesh
        position={[shaftStart.x, targetVector.y + shaftHeight / 2, shaftStart.z]}
      >
        <cylinderGeometry args={[0.035, 0.035, shaftHeight, 12]} />
        <meshStandardMaterial
          color="#cbd5f5"
          emissive="#7dd3fc"
          emissiveIntensity={0.35}
          metalness={0.9}
          roughness={0.2}
          transparent
          opacity={0.75}
        />
      </mesh>
      <group ref={group} position={targetVector}>
        <mesh>
          <sphereGeometry args={[0.14, 24, 24]} />
          <meshStandardMaterial
            color="#f8fafc"
            emissive="#38bdf8"
            emissiveIntensity={2.2}
          />
        </mesh>
        <mesh ref={glow}>
          <sphereGeometry args={[0.26, 20, 20]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} />
        </mesh>
        <pointLight color="#38bdf8" intensity={6} distance={3} />
      </group>
    </group>
  )
}
