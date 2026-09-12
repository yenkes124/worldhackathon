import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import { key } from '../../sim/grid'
import { useSimulation } from '../../state/simulationStore'
import { BrainShell } from './BrainShell'
import { Probe } from './Probe'
import { TrajectoryLines } from './TrajectoryLines'
import { VoxelGrid } from './VoxelGrid'

export const BrainScene = () => {
  const scenario = useSimulation((state) => state.scenario)
  const entry = useSimulation((state) => state.entry)
  const plan = useSimulation((state) => state.plan)
  const stepIndex = useSimulation((state) => state.stepIndex)
  const showFailed = useSimulation((state) => state.showFailed)
  const failedPath = useSimulation((state) => state.failedPath)
  const highlight = useSimulation((state) => state.highlightContext)
  const setEntry = useSimulation((state) => state.setEntry)

  const pathKeys = useMemo(
    () => new Set(plan.path.map((position) => key(position))),
    [plan.path],
  )

  return (
    <Canvas
      camera={{ position: [6.2, 4.4, 6.8], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, localClippingEnabled: true }}
    >
      <color attach="background" args={['#05070f']} />
      <fog attach="fog" args={['#05070f', 12, 26]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 8, 4]} intensity={1.1} color="#9ec5ff" />
      <directionalLight position={[-6, -3, -5]} intensity={0.5} color="#a855f7" />

      <pointLight position={[0, 3, 0]} intensity={12} distance={12} color="#22d3ee" />

      <BrainShell seed={scenario.seed} />
      <VoxelGrid
        entry={entry}
        target={scenario.target}
        highlight={highlight}
        pathKeys={pathKeys}
        onSelectEntry={setEntry}
      />
      <TrajectoryLines
        path={plan.path}
        stepIndex={stepIndex}
        failedPath={failedPath}
        showFailed={showFailed}
      />
      <Probe path={plan.path} stepIndex={stepIndex} />

      <gridHelper
        args={[16, 16, '#1e293b', '#111a2f']}
        position={[0, -3.2, 0]}
      />
      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={16}
        autoRotate
        autoRotateSpeed={0.35}
        target={[0, 0, 0]}
      />
    </Canvas>
  )
}
