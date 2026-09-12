import { Line } from '@react-three/drei'
import { toScenePosition } from '../../sim/grid'
import type { Vec3 } from '../../sim/types'

const toPoints = (path: Vec3[]): [number, number, number][] =>
  path.map((position) => toScenePosition(position))

interface TrajectoryLinesProps {
  path: Vec3[]
  stepIndex: number
  failedPath: Vec3[]
  showFailed: boolean
}

export const TrajectoryLines = ({
  path,
  stepIndex,
  failedPath,
  showFailed,
}: TrajectoryLinesProps) => {
  const planned = toPoints(path)
  const travelled = toPoints(path.slice(0, stepIndex + 1))
  const failed = toPoints(failedPath)

  return (
    <group>
      {planned.length > 1 && (
        <Line
          points={planned}
          color="#34ff9b"
          lineWidth={1.6}
          transparent
          opacity={0.35}
          dashed
          dashSize={0.18}
          gapSize={0.12}
        />
      )}
      {travelled.length > 1 && (
        <Line points={travelled} color="#34ff9b" lineWidth={3.4} />
      )}
      {showFailed && failed.length > 1 && (
        <Line
          points={failed}
          color="#ff4d6a"
          lineWidth={2.6}
          dashed
          dashSize={0.22}
          gapSize={0.14}
        />
      )}
    </group>
  )
}
