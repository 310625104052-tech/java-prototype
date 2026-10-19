import { useEffect, useRef, useState, useCallback } from 'react';
import type { SceneManager } from './scene/SceneManager';
import { sampleCollegeFloorPlan } from './data/sampleCollegeFloorPlan';
import { UIManager } from './ui/UIManager';
import { FloorPlanData } from './types/floorplan';
import { LocationSystem } from './navigation/LocationSystem';
import { Loader2 } from 'lucide-react';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);

  const [currentFloorPlan, setCurrentFloorPlan] = useState<FloorPlanData>(sampleCollegeFloorPlan);
  const [hasModel, setHasModel] = useState(false);
  const [isOverview, setIsOverview] = useState(true);
  const [isCeilingVisible, setIsCeilingVisible] = useState(false);
  const [modelFileName, setModelFileName] = useState('');
  const [showDetailedMap, setShowDetailedMap] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [sceneLoading, setSceneLoading] = useState(false);
  const [graphicsError, setGraphicsError] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [playerPos, setPlayerPos] = useState({
    x: sampleCollegeFloorPlan.spawnPoint.x,
    z: sampleCollegeFloorPlan.spawnPoint.y,
    yaw: sampleCollegeFloorPlan.spawnPoint.yaw || 0,
  });
  const playerPosRef = useRef({
    x: sampleCollegeFloorPlan.spawnPoint.x,
    z: sampleCollegeFloorPlan.spawnPoint.y,
    yaw: sampleCollegeFloorPlan.spawnPoint.yaw || 0,
  });

  useEffect(() => {
    if (!hasModel || !containerRef.current) return;

    let cancelled = false;
    let manager: SceneManager | undefined;
    let lastRoomName = '';
    let lastFacingText = '';
    let lastCoordsText = '';

    // The upload/review screens need neither the Three.js bundle nor a WebGL context.
    void import('./scene/SceneManager')
      .then(({ SceneManager }) => {
        if (cancelled || !containerRef.current) return;
        manager = new SceneManager(containerRef.current, currentFloorPlan);
        sceneManagerRef.current = manager;

        manager.controller.setOnLockChange((locked) => {
          setIsLocked(locked);
          if (!locked) {
            // When exiting lock / pausing, sync latest position to React state for pause dialog & map
            setPlayerPos({ ...playerPosRef.current });
          }
          if (locked) setLockError(null);
        });
        manager.controller.setOnLockError(setLockError);

        // Blazing-fast direct DOM updates: zero React re-renders while walking, guaranteeing fixed 60 FPS
        manager.controller.setOnPositionUpdate((x, z, yaw) => {
          playerPosRef.current = { x, z, yaw };

          const loc = LocationSystem.getLocationInfo(x, z, yaw, currentFloorPlan);

          const hudRoom = document.getElementById('studio-hud-room');
          if (hudRoom && lastRoomName !== loc.roomName) {
            hudRoom.textContent = loc.roomName;
            lastRoomName = loc.roomName;
          }

          const hudFacing = document.getElementById('studio-hud-facing');
          const facingStr = `${loc.facing.cardinal} · ${loc.facing.degrees}°`;
          if (hudFacing && lastFacingText !== facingStr) {
            hudFacing.textContent = facingStr;
            lastFacingText = facingStr;
          }

          const marker = document.getElementById('studio-minimap-marker');
          if (marker) {
            marker.setAttribute('transform', `translate(${x.toFixed(2)}, ${z.toFixed(2)})`);
          }

          const cone = document.getElementById('studio-minimap-cone');
          if (cone) {
            cone.setAttribute('transform', `rotate(${((-yaw * 180) / Math.PI).toFixed(1)})`);
          }

          const miniFacing = document.getElementById('studio-minimap-facing-val');
          if (miniFacing && miniFacing.textContent !== facingStr) {
            miniFacing.textContent = facingStr;
          }

          const miniRoom = document.getElementById('studio-minimap-room');
          if (miniRoom && miniRoom.textContent !== loc.roomName) {
            miniRoom.textContent = loc.roomName;
          }

          const miniCoords = document.getElementById('studio-minimap-coords');
          const coordsStr = `${x.toFixed(1)}m · ${z.toFixed(1)}m`;
          if (miniCoords && lastCoordsText !== coordsStr) {
            miniCoords.textContent = coordsStr;
            lastCoordsText = coordsStr;
          }
        });

        manager.controller.setOnToggleCeiling(() => {
          if (!manager) return;
          const next = manager.toggleCeiling();
          setIsCeilingVisible(next);
        });
        manager.controller.setOnResetPlayer(() => manager?.resetPlayerPosition());
        manager.controller.setOnToggleMap(() => {
          manager?.controller.exitLock();
          setPlayerPos({ ...playerPosRef.current });
          setShowDetailedMap(true);
        });
        manager.setOverview(true);
        setIsCeilingVisible(manager.floorPlanRenderer.isCeilingVisible);
        manager.start();
        setSceneLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        manager?.dispose();
        manager = undefined;
        sceneManagerRef.current = null;
        console.error('Could not start the 3D renderer:', err);
        setGraphicsError(true);
        setSceneLoading(false);
      });

    return () => {
      cancelled = true;
      manager?.dispose();
      sceneManagerRef.current = null;
    };
  }, [hasModel, currentFloorPlan]);

  const handleEnterFirstPerson = useCallback(() => {
    if (!sceneManagerRef.current) return;
    setLockError(null);
    sceneManagerRef.current.setOverview(false);
    setIsCeilingVisible(sceneManagerRef.current.floorPlanRenderer.isCeilingVisible);
    setIsOverview(false);
    sceneManagerRef.current.controller.requestLock();
  }, []);

  const handleToggleCeiling = useCallback(() => {
    if (!sceneManagerRef.current) return;
    const next = sceneManagerRef.current.toggleCeiling();
    setIsCeilingVisible(next);
  }, []);

  const handleTeleport = useCallback((x: number, y: number) => {
    playerPosRef.current = { x, z: y, yaw: 0 };
    setPlayerPos({ x, z: y, yaw: 0 });
    sceneManagerRef.current?.controller.setPosition(x, 1.65, y);
    sceneManagerRef.current?.invalidate();
  }, []);

  const handlePlanReady = useCallback((plan: FloorPlanData, fileName: string) => {
    setSceneLoading(true);
    setGraphicsError(false);
    setLockError(null);
    setShowDetailedMap(false);
    setCurrentFloorPlan(plan);
    setModelFileName(fileName);
    setPlayerPos({
      x: plan.spawnPoint.x,
      z: plan.spawnPoint.y,
      yaw: plan.spawnPoint.yaw || 0,
    });
    setIsOverview(true);
    setHasModel(true);
  }, []);

  const handleNewUpload = useCallback(() => {
    sceneManagerRef.current?.controller.exitLock();
    setHasModel(false);
    setIsLocked(false);
    setShowDetailedMap(false);
    setGraphicsError(false);
    setSceneLoading(false);
  }, []);

  const handleOverview = useCallback(() => {
    sceneManagerRef.current?.setOverview(true);
    if (sceneManagerRef.current) {
      setIsCeilingVisible(sceneManagerRef.current.floorPlanRenderer.isCeilingVisible);
    }
    setIsOverview(true);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#f6f2ea] font-sans select-none">
      {/* 3D WebGL Canvas Container */}
      <div
        id="viewport-3d"
        ref={containerRef}
        className="w-full h-full cursor-pointer focus:outline-none"
        onClick={() => {
          if (hasModel && !isOverview && !isLocked && !showDetailedMap) {
            handleEnterFirstPerson();
          }
        }}
      />

      {hasModel && sceneLoading && (
        <div
          role="status"
          aria-live="polite"
          className="studio-loading-veil"
        >
          <Loader2 className="studio-spinner" aria-hidden="true" />
          <span>Opening your space…</span>
        </div>
      )}

      {graphicsError && (
        <div
          role="alert"
          className="studio-graphics-error"
        >
          <div className="studio-pause-dialog">
            <h1>3D graphics could not start</h1>
            <p className="studio-lead" style={{ margin: '12px auto 24px', maxWidth: '38ch' }}>
              The 3D view could not be loaded. Try opening your drawing again. If it keeps
              happening, check your connection and that hardware acceleration is enabled in your
              browser.
            </p>
            <button className="studio-primary" onClick={handleNewUpload}>
              Back to drawings
            </button>
          </div>
        </div>
      )}

      <UIManager
        floorPlan={currentFloorPlan}
        hasModel={hasModel}
        isOverview={isOverview}
        isCeilingVisible={isCeilingVisible}
        onToggleCeiling={handleToggleCeiling}
        onOverview={handleOverview}
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
