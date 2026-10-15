import { useEffect, useRef, useState } from 'react';
import { SceneManager } from './scene/SceneManager';
import { sampleFloorPlan } from './data/sampleFloorPlan';
import { sampleCollegeFloorPlan } from './data/sampleCollegeFloorPlan';
import { UIManager } from './ui/UIManager';
import { UploadedBlueprint } from './types/blueprint';
import { FloorPlanData } from './types/floorplan';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);

  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlanData>(sampleCollegeFloorPlan);
  const [isLocked, setIsLocked] = useState(false);
  const [isCeilingVisible, setIsCeilingVisible] = useState(true);
  const [uploadedBlueprint, setUploadedBlueprint] = useState<UploadedBlueprint | null>(null);
  const [playerPos, setPlayerPos] = useState({
    x: sampleCollegeFloorPlan.spawnPoint.x,
    z: sampleCollegeFloorPlan.spawnPoint.y,
    yaw: sampleCollegeFloorPlan.spawnPoint.yaw || 0,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize 3D Scene Manager with College Science & Tech Floor Plan
    const manager = new SceneManager(containerRef.current, sampleCollegeFloorPlan);
    sceneManagerRef.current = manager;

    // Controller callbacks
    manager.controller.setOnLockChange((locked) => {
      setIsLocked(locked);
    });

    manager.controller.setOnPositionUpdate((x, z, yaw) => {
      setPlayerPos({ x, z, yaw });
    });

    manager.controller.setOnToggleCeiling(() => {
      const visible = manager.toggleCeiling();
      setIsCeilingVisible(visible);
    });

    manager.controller.setOnResetPlayer(() => {
      manager.resetPlayerPosition();
    });

    // Start render loop
    manager.start();

    // Global keyboard shortcuts for quick testing & faculty presentation
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (e.code === 'KeyC') {
        const visible = manager.toggleCeiling();
        setIsCeilingVisible(visible);
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
    sceneManagerRef.current?.controller.requestLock();
  };

  const handleToggleCeiling = () => {
    if (sceneManagerRef.current) {
      const visible = sceneManagerRef.current.toggleCeiling();
      setIsCeilingVisible(visible);
    }
  };

  const handleResetPosition = () => {
    sceneManagerRef.current?.resetPlayerPosition();
  };

  const handleTeleport = (x: number, y: number) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.controller.setPosition(x, 1.65, y);
    }
  };

  const handleLoadSampleHouse = () => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.loadFloorPlan(sampleFloorPlan);
      setCurrentFloorPlan(sampleFloorPlan);
      setIsCeilingVisible(true);
      setPlayerPos({
        x: sampleFloorPlan.spawnPoint.x,
        z: sampleFloorPlan.spawnPoint.y,
        yaw: sampleFloorPlan.spawnPoint.yaw || 0,
      });
    }
  };

  const handleLoadCollegeFloorPlan = () => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.loadFloorPlan(sampleCollegeFloorPlan);
      setCurrentFloorPlan(sampleCollegeFloorPlan);
      setIsCeilingVisible(true);
      setPlayerPos({
        x: sampleCollegeFloorPlan.spawnPoint.x,
        z: sampleCollegeFloorPlan.spawnPoint.y,
        yaw: sampleCollegeFloorPlan.spawnPoint.yaw || 0,
      });
    }
  };

  const handleLoadGeneratedFloorPlan = (newPlan: FloorPlanData) => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.loadFloorPlan(newPlan);
      setCurrentFloorPlan(newPlan);
      setIsCeilingVisible(true);
      setPlayerPos({
        x: newPlan.spawnPoint.x,
        z: newPlan.spawnPoint.y,
        yaw: newPlan.spawnPoint.yaw || 0,
      });
    }
  };

  const handleBlueprintUploaded = (blueprint: UploadedBlueprint) => {
    if (uploadedBlueprint?.previewUrl) {
      URL.revokeObjectURL(uploadedBlueprint.previewUrl);
    }
    setUploadedBlueprint(blueprint);
  };

  const handleClearBlueprint = () => {
    if (uploadedBlueprint?.previewUrl) {
      URL.revokeObjectURL(uploadedBlueprint.previewUrl);
    }
    setUploadedBlueprint(null);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Container */}
      <div
        id="viewport-3d"
        ref={containerRef}
        className="w-full h-full cursor-pointer focus:outline-none"
        onClick={() => {
          if (!isLocked) {
            handleEnterFirstPerson();
          }
        }}
      />

      {/* User Interface HUD & Controls */}
      <UIManager
        floorPlan={currentFloorPlan}
        isLocked={isLocked}
        isCeilingVisible={isCeilingVisible}
        playerPos={playerPos}
        blueprint={uploadedBlueprint}
        onEnterFirstPerson={handleEnterFirstPerson}
        onToggleCeiling={handleToggleCeiling}
        onResetPosition={handleResetPosition}
        onTeleport={handleTeleport}
        onLoadSampleHouse={handleLoadSampleHouse}
        onLoadCollegeFloorPlan={handleLoadCollegeFloorPlan}
        onLoadGeneratedFloorPlan={handleLoadGeneratedFloorPlan}
        onBlueprintUploaded={handleBlueprintUploaded}
        onClearBlueprint={handleClearBlueprint}
      />
    </main>
  );
}
