import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useMemo } from 'react'
import { key } from '../../sim/grid'
import { selectExploreCheck, useSimulation } from '../../state/simulationStore'
import { BrainShell } from './BrainShell'
import { KnowledgeVoxels } from './KnowledgeVoxels'
import { Probe } from './Probe'
import { TrajectoryLines } from './TrajectoryLines'
import { VoxelGrid } from './VoxelGrid'

export const BrainScene = () => {
  const scenario = useSimulation((state) => state.scenario)
  const mode = useSimulation((state) => state.mode)
  const guidedEntry = useSimulation((state) => state.entry)
  const plan = useSimulation((state) => state.plan)
  const stepIndex = useSimulation((state) => state.stepIndex)
  const showFailed = useSimulation((state) => state.showFailed)
  const failedPath = useSimulation((state) => state.failedPath)
  const highlight = useSimulation((state) => state.highlightContext)
  const setEntry = useSimulation((state) => state.setEntry)
  const exploreEntry = useSimulation((state) => state.exploreEntry)
  const exploreVisitedPath = useSimulation((state) => state.exploreVisitedPath)
  const exploreRouteProposal = useSimulation(
    (state) => state.exploreRouteProposal,
  )
  const setExploreEntry = useSimulation((state) => state.setExploreEntry)
  const exploreKnowledge = useSimulation((state) => state.exploreKnowledgeMap)
  const exploreCurrent = useSimulation((state) => state.exploreCurrentPosition)
  const exploreCheck = useSimulation(selectExploreCheck)

  const isExplore = mode === 'explore'
  const entry = isExplore ? exploreEntry : guidedEntry
  // In explore mode the probe only ever follows cells a simulated safety check
  // has already cleared, so it can never animate into a restricted cell.
  const probePath = isExplore ? exploreVisitedPath : plan.path
  const probeStepIndex = isExplore ? exploreVisitedPath.length - 1 : stepIndex
  const plannedRoute = isExplore
    ? (exploreRouteProposal?.route ?? exploreVisitedPath)
    : plan.path

  const pathKeys = useMemo(
    () => new Set(plannedRoute.map((position) => key(position))),
    [plannedRoute],
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
      {isExplore ? (
        <KnowledgeVoxels
          knowledge={exploreKnowledge}
          entry={entry}
          probe={exploreCurrent}
          checkedCell={exploreCheck.cell}
          verdict={exploreCheck.verdict}
          onSelectEntry={setExploreEntry}
        />
      ) : (
        <VoxelGrid
          entry={entry}
          target={scenario.target}
          highlight={highlight}
          pathKeys={pathKeys}
          onSelectEntry={setEntry}
        />
      )}
      <TrajectoryLines
        path={plannedRoute}
        stepIndex={isExplore ? 0 : stepIndex}
        failedPath={failedPath}
        showFailed={!isExplore && showFailed}
      />
      <Probe path={probePath} stepIndex={probeStepIndex} />

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
