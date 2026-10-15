import { useEffect, useRef, useState } from 'react';
import { SceneManager } from './scene/SceneManager';
import { sampleCollegeFloorPlan } from './data/sampleCollegeFloorPlan';
import { UIManager } from './ui/UIManager';
import { FloorPlanData } from './types/floorplan';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);

  // The scene needs a plan to boot with; it stays hidden behind the start screen
  // until the user uploads their own.
  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlanData>(sampleCollegeFloorPlan);
  const [hasModel, setHasModel] = useState(false);
  const [modelFileName, setModelFileName] = useState('');
  const [showDetailedMap, setShowDetailedMap] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [playerPos, setPlayerPos] = useState({
    x: sampleCollegeFloorPlan.spawnPoint.x,
    z: sampleCollegeFloorPlan.spawnPoint.y,
    yaw: sampleCollegeFloorPlan.spawnPoint.yaw || 0,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const manager = new SceneManager(containerRef.current, sampleCollegeFloorPlan);
    sceneManagerRef.current = manager;

    manager.controller.setOnLockChange((locked) => {
      setIsLocked(locked);
      if (locked) setLockError(null);
    });

    manager.controller.setOnLockError(setLockError);

    manager.controller.setOnPositionUpdate((x, z, yaw) => {
      setPlayerPos({ x, z, yaw });
    });

    manager.controller.setOnToggleCeiling(() => {
      manager.toggleCeiling();
    });

    manager.controller.setOnResetPlayer(() => {
      manager.resetPlayerPosition();
    });

    // The map is a normal mouse-driven overlay, so release the pointer first.
    manager.controller.setOnToggleMap(() => {
      manager.controller.exitLock();
      setShowDetailedMap(true);
    });

    manager.start();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (e.code === 'KeyC') {
        manager.toggleCeiling();
      } else if (e.code === 'KeyR') {
        manager.resetPlayerPosition();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      manager.dispose();
      sceneManagerRef.current = null;
    };
  }, []);

  const handleEnterFirstPerson = () => {
    setLockError(null);
    sceneManagerRef.current?.controller.requestLock();
  };

  const handleTeleport = (x: number, y: number) => {
    sceneManagerRef.current?.controller.setPosition(x, 1.65, y);
  };

  const handlePlanReady = (plan: FloorPlanData, fileName: string) => {
    sceneManagerRef.current?.loadFloorPlan(plan);
    setCurrentFloorPlan(plan);
    setModelFileName(fileName);
    setPlayerPos({
      x: plan.spawnPoint.x,
      z: plan.spawnPoint.y,
      yaw: plan.spawnPoint.yaw || 0,
    });
    setHasModel(true);
  };

  const handleNewUpload = () => {
    sceneManagerRef.current?.controller.exitLock();
    setHasModel(false);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Container */}
      <div
        id="viewport-3d"
        ref={containerRef}
        className="w-full h-full cursor-pointer focus:outline-none"
        onClick={() => {
          if (hasModel && !isLocked && !showDetailedMap) {
            handleEnterFirstPerson();
          }
        }}
      />

      <UIManager
        floorPlan={currentFloorPlan}
        hasModel={hasModel}
        modelFileName={modelFileName}
        isLocked={isLocked}
        lockError={lockError}
        playerPos={playerPos}
        showDetailedMap={showDetailedMap}
        onShowDetailedMap={setShowDetailedMap}
        onEnterFirstPerson={handleEnterFirstPerson}
        onTeleport={handleTeleport}
        onPlanReady={handlePlanReady}
        onNewUpload={handleNewUpload}
      />
    </main>
  );
}
