import { useMemo } from 'react'
import * as THREE from 'three'
import { mulberry32 } from '../../sim/rng'

/**
 * Procedural, deliberately non-anatomical hemisphere shell. A seeded low-poly
 * displacement keeps the silhouette organic while staying reproducible.
 */
const useBrainGeometry = (seed: number) =>
  useMemo(() => {
    const geometry = new THREE.IcosahedronGeometry(3.1, 4)
    const random = mulberry32(seed)
    const jitter = Array.from({ length: 24 }, () => random() * 2 - 1)
    const position = geometry.attributes.position
    const vertex = new THREE.Vector3()

    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i)
      const n = vertex.clone().normalize()
      const folds =
        Math.sin(n.x * 6 + jitter[0]) * 0.09 +
        Math.sin(n.y * 7 + jitter[1]) * 0.08 +
        Math.sin(n.z * 5 + jitter[2]) * 0.07 +
        Math.sin((n.x + n.y) * 9 + jitter[3]) * 0.05
      const lobes = 1 + n.z * 0.06 - Math.abs(n.y) * 0.05
      vertex.multiplyScalar(lobes + folds)
      vertex.y *= 0.82
      vertex.z *= 1.12
      position.setXYZ(i, vertex.x, vertex.y, vertex.z)
    }

    position.needsUpdate = true
    geometry.computeVertexNormals()
    return geometry
  }, [seed])

interface BrainShellProps {
  seed: number
}

export const BrainShell = ({ seed }: BrainShellProps) => {
  const geometry = useBrainGeometry(seed)
  const clipPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1.15),
    [],
  )

  return (
    <group position={[0, 0, 0]}>
      <mesh geometry={geometry} renderOrder={1}>
        <meshPhysicalMaterial
          color="#4c6fff"
          transparent
          opacity={0.1}
          roughness={0.45}
          metalness={0.05}
          transmission={0.6}
          thickness={1.4}
          clearcoat={0.6}
          side={THREE.DoubleSide}
          clippingPlanes={[clipPlane]}
          depthWrite={false}
        />
      </mesh>
      <lineSegments renderOrder={3}>
        <wireframeGeometry args={[geometry]} />
        <lineBasicMaterial
          color="#6ea8ff"
          transparent
          opacity={0.08}
          clippingPlanes={[clipPlane]}
        />
      </lineSegments>
    </group>
  )
}
