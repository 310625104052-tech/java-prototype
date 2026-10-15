import { useState } from 'react';
import { CheckCircle2, Code2, Compass, Footprints, Navigation, Upload } from 'lucide-react';
import { FloorPlanData } from '../types/floorplan';
import { DetailedMapModal } from './DetailedMapModal';
import { FloorPlanInspector } from './FloorPlanInspector';
import { StartScreen } from './StartScreen';
import { LocationSystem } from '../navigation/LocationSystem';

interface UIManagerProps {
  floorPlan: FloorPlanData;
  hasModel: boolean;
  modelFileName: string;
  isLocked: boolean;
  lockError?: string | null;
  playerPos: { x: number; z: number; yaw: number };
  showDetailedMap: boolean;
  onShowDetailedMap: (show: boolean) => void;
  onEnterFirstPerson: () => void;
  onTeleport: (x: number, y: number) => void;
  onPlanReady: (plan: FloorPlanData, fileName: string) => void;
  onNewUpload: () => void;
}

// Key hints shown in the slim bar while walking.
const CONTROL_HINTS: { keys: string; label: string }[] = [
  { keys: 'W A S D', label: 'Move' },
  { keys: 'Shift', label: 'Sprint' },
  { keys: 'Mouse', label: 'Look' },
  { keys: 'M', label: 'Map' },
  { keys: 'C', label: 'Ceiling' },
  { keys: 'R', label: 'Reset' },
  { keys: 'Esc', label: 'Pause' },
];

export function UIManager({
  floorPlan,
  hasModel,
  modelFileName,
  isLocked,
  lockError,
  playerPos,
  showDetailedMap,
  onShowDetailedMap,
  onEnterFirstPerson,
  onTeleport,
  onPlanReady,
  onNewUpload,
}: UIManagerProps) {
  const [showJsonInspector, setShowJsonInspector] = useState(false);

  const locationInfo = LocationSystem.getLocationInfo(playerPos.x, playerPos.z, playerPos.yaw, floorPlan);

  const showReadyCard = hasModel && !isLocked && !showDetailedMap && !showJsonInspector;

  return (
    <>
      {/* 1. Start screen: upload is the only thing on screen until a model exists */}
      {!hasModel && <StartScreen onPlanReady={onPlanReady} />}

      {/* 2. Model ready / paused: one card, one primary action */}
      {showReadyCard && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/50 backdrop-blur-[2px]">
          <div className="mx-4 w-full max-w-md rounded-3xl border border-slate-700/80 bg-slate-900/95 p-6 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400" />
            <h2 className="mt-3 text-xl font-bold tracking-tight text-white">Your 3D model is ready</h2>
            <p className="mt-1 truncate text-xs text-slate-400" title={modelFileName}>
              {modelFileName}
            </p>
            <p className="mt-3 text-xs text-slate-300">
              {floorPlan.walls.length} walls · {floorPlan.doors.length} doors · {floorPlan.windows.length} windows ·{' '}
              {floorPlan.rooms.length} rooms
            </p>

            {lockError && (
              <div
                id="pointer-lock-error"
                role="alert"
                className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-[11px] leading-snug text-amber-200"
              >
                {lockError}
              </div>
            )}

            <button
              type="button"
              id="click-to-enter-btn"
              onClick={onEnterFirstPerson}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-sky-500/25 transition-all hover:bg-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              <Footprints className="h-4 w-4" />
              Walk through
            </button>
            <p className="mt-2 text-[11px] text-slate-500">Controls appear at the bottom once you start.</p>

            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => onShowDetailedMap(true)}
                className="flex items-center gap-1.5 text-slate-400 transition-colors hover:text-white"
              >
                <Navigation className="h-3.5 w-3.5" /> Map
              </button>
              <button
                type="button"
                onClick={() => setShowJsonInspector(true)}
                className="flex items-center gap-1.5 text-slate-400 transition-colors hover:text-white"
              >
                <Code2 className="h-3.5 w-3.5" /> Model data
              </button>
              <button
                type="button"
                id="upload-another-btn"
                onClick={onNewUpload}
                className="flex items-center gap-1.5 text-slate-400 transition-colors hover:text-white"
              >
                <Upload className="h-3.5 w-3.5" /> Upload another
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Walking: crosshair, current room, and a slim controls bar */}
      {isLocked && (
        <>
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.9)]"></div>
            <div className="absolute h-[1px] w-4 bg-white/40"></div>
            <div className="absolute h-4 w-[1px] bg-white/40"></div>
          </div>

          <div className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2">
            <div className="flex items-center gap-3 rounded-full border border-slate-700/60 bg-slate-900/85 px-4 py-1.5 text-xs text-slate-300 shadow-xl backdrop-blur-md">
              <span className="font-bold tracking-wide text-white">{locationInfo.roomName}</span>
              <span className="flex items-center gap-1 font-mono text-[11px] text-sky-400">
                <Compass className="h-3.5 w-3.5" />
                {locationInfo.facing.cardinal}
              </span>
            </div>
          </div>

          <div
            id="controls-bar"
            className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex w-max max-w-[95vw] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-slate-700/60 bg-slate-900/80 px-4 py-1.5 text-[11px] text-slate-400 backdrop-blur-md"
          >
            {CONTROL_HINTS.map((hint) => (
              <span key={hint.label} className="flex items-center gap-1.5">
                <kbd className="rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-400">
                  {hint.keys}
                </kbd>
                {hint.label}
              </span>
            ))}
          </div>
        </>
      )}

      <DetailedMapModal
        isOpen={showDetailedMap}
        floorPlan={floorPlan}
        playerPos={playerPos}
        onClose={() => onShowDetailedMap(false)}
        onTeleport={onTeleport}
      />

      <FloorPlanInspector
        floorPlan={floorPlan}
        isOpen={showJsonInspector}
        onClose={() => setShowJsonInspector(false)}
      />
    </>
  );
}
