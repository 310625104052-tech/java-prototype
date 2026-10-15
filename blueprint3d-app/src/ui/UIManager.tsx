import { useState } from 'react';
import {
  RotateCcw,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Code2,
  MapPin,
  Compass,
  Footprints,
  MousePointer2,
  Home,
  Upload,
  Building2,
  Navigation,
} from 'lucide-react';
import { FloorPlanData } from '../types/floorplan';
import { UploadedBlueprint } from '../types/blueprint';
import { Minimap } from './Minimap';
import { DetailedMapModal } from './DetailedMapModal';
import { FloorPlanInspector } from './FloorPlanInspector';
import { BlueprintUploader } from './BlueprintUploader';
import { LocationSystem } from '../navigation/LocationSystem';

interface UIManagerProps {
  floorPlan: FloorPlanData;
  isLocked: boolean;
  isCeilingVisible: boolean;
  playerPos: { x: number; z: number; yaw: number };
  blueprint: UploadedBlueprint | null;
  onEnterFirstPerson: () => void;
  onToggleCeiling: () => void;
  onResetPosition: () => void;
  onTeleport: (x: number, y: number) => void;
  onLoadSampleHouse: () => void;
  onLoadCollegeFloorPlan?: () => void;
  onLoadGeneratedFloorPlan?: (plan: FloorPlanData) => void;
  onBlueprintUploaded: (blueprint: UploadedBlueprint) => void;
  onClearBlueprint: () => void;
}

export function UIManager({
  floorPlan,
  isLocked,
  isCeilingVisible,
  playerPos,
  blueprint,
  onEnterFirstPerson,
  onToggleCeiling,
  onResetPosition,
  onTeleport,
  onLoadSampleHouse,
  onLoadCollegeFloorPlan,
  onLoadGeneratedFloorPlan,
  onBlueprintUploaded,
  onClearBlueprint,
}: UIManagerProps) {
  const [showMinimap, setShowMinimap] = useState(true);
  const [showDetailedMap, setShowDetailedMap] = useState(false);
  const [showJsonInspector, setShowJsonInspector] = useState(false);
  const [showBlueprintPanel, setShowBlueprintPanel] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Real-time spatial localization
  const locationInfo = LocationSystem.getLocationInfo(
    playerPos.x,
    playerPos.z,
    playerPos.yaw,
    floorPlan
  );

  return (
    <>
      {/* Top Header Bar */}
      <header className="absolute top-0 left-0 right-0 z-30 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
        {/* Project & Building Branding */}
        <div className="flex items-center gap-3 pointer-events-auto bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700/70 shadow-xl">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white">
                {floorPlan.name || 'College Digital Tour'}
              </h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                {floorPlan.floorLevel || 'Floor 2'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Interactive 3D Architectural Walkthrough & CAD Synchronization
            </p>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700/70 shadow-xl">
          {/* Detailed Navigation Map Toggle [Key: M] */}
          <button
            id="toggle-detailed-map-btn"
            onClick={() => setShowDetailedMap(true)}
            title="Open Detailed Navigation Map [Key: M]"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-md shadow-sky-500/20"
          >
            <Navigation className="w-4 h-4" />
            <span className="hidden md:inline">Detailed Map [M]</span>
          </button>

          {/* Toggle Ceiling Button [Key: C] */}
          <button
            id="toggle-ceiling-btn"
            onClick={onToggleCeiling}
            title="Toggle Ceiling [Key: C]"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              isCeilingVisible
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}
          >
            {isCeilingVisible ? <Eye className="w-4 h-4 text-sky-400" /> : <EyeOff className="w-4 h-4 text-amber-400" />}
            <span className="hidden sm:inline">Ceiling: {isCeilingVisible ? 'ON' : 'OFF'} [C]</span>
          </button>

          {/* Reset Position Button [Key: R] */}
          <button
            id="reset-pos-btn"
            onClick={onResetPosition}
            title="Reset Starting Position [Key: R]"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-all"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span className="hidden lg:inline">Reset [R]</span>
          </button>

          {/* College Demo Floor Plan */}
          {onLoadCollegeFloorPlan && (
            <button
              id="load-college-plan-btn"
              onClick={onLoadCollegeFloorPlan}
              title="Load College Science & Tech Complex"
              className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-all"
            >
              <Building2 className="w-4 h-4 text-sky-400" />
              <span>College Complex</span>
            </button>
          )}

          {/* Sample House */}
          <button
            id="load-sample-house-btn"
            onClick={onLoadSampleHouse}
            title="Load Residential Sample House"
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-all"
          >
            <Home className="w-4 h-4 text-slate-400" />
            <span>Sample House</span>
          </button>

          {/* Blueprint Input Panel Toggle */}
          <button
            id="toggle-blueprint-panel-btn"
            onClick={() => setShowBlueprintPanel(!showBlueprintPanel)}
            title="Toggle Blueprint Detection / Upload Panel"
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              showBlueprintPanel
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">2D Blueprint</span>
            {blueprint && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
          </button>

          {/* View Floor Plan JSON Inspector */}
          <button
            id="inspect-json-btn"
            onClick={() => setShowJsonInspector(true)}
            title="Inspect Floor Plan Geometric Schema"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
          >
            <Code2 className="w-4 h-4 text-emerald-400" />
          </button>

          {/* Toggle Minimap */}
          <button
            id="toggle-map-btn"
            onClick={() => setShowMinimap(!showMinimap)}
            title="Toggle Live 2D Minimap"
            className={`p-1.5 rounded-xl transition-all ${
              showMinimap ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            id="toggle-fullscreen-btn"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Blueprint Upload / Reconstruction Panel (Left) */}
      {!isLocked && showBlueprintPanel && (
        <aside className="absolute top-20 left-4 z-30 max-h-[calc(100vh-6rem)] overflow-y-auto pointer-events-auto pr-1">
          <BlueprintUploader
            blueprint={blueprint}
            onBlueprintUploaded={onBlueprintUploaded}
            onClearBlueprint={onClearBlueprint}
            onLoadSampleHouse={onLoadSampleHouse}
            onLoadCollegeFloorPlan={onLoadCollegeFloorPlan}
            onLoadGeneratedFloorPlan={onLoadGeneratedFloorPlan}
            onEnterFirstPerson={onEnterFirstPerson}
            onViewFloorPlan={() => setShowDetailedMap(true)}
            onOpenJsonSchema={() => setShowJsonInspector(true)}
          />
        </aside>
      )}

      {/* Center Reticle when in First-Person Mode */}
      {isLocked && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
          <div className="w-2 h-2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.9)]"></div>
          <div className="absolute w-4 h-[1px] bg-white/40"></div>
          <div className="absolute h-4 w-[1px] bg-white/40"></div>
        </div>
      )}

      {/* Floating Active Room & Coordinates Badge (when locked or active) */}
      {isLocked && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-xs text-slate-300 shadow-2xl flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse"></span>
              <span className="font-bold text-white tracking-wide">{locationInfo.roomName}</span>
            </div>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] font-mono text-sky-400 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5" />
              {locationInfo.facing.label} ({locationInfo.facing.degrees}°)
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-[11px] text-slate-400 font-mono">
              {locationInfo.coordinatesFormatted}
            </span>
          </div>
        </div>
      )}

      {/* Minimap Widget (Bottom Right) */}
      {showMinimap && (
        <aside className="absolute bottom-4 right-4 z-20 pointer-events-auto">
          <Minimap
            floorPlan={floorPlan}
            playerPos={playerPos}
            onTeleport={onTeleport}
            onOpenDetailedMap={() => setShowDetailedMap(true)}
          />
        </aside>
      )}

      {/* Walkthrough Entry Prompt (Shown when cursor is not locked) */}
      {!isLocked && (
        <div
          onClick={onEnterFirstPerson}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-[2px] cursor-pointer group transition-all"
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              onEnterFirstPerson();
            }}
            className="max-w-lg w-full mx-4 p-6 bg-slate-900/95 border border-slate-700/80 rounded-3xl shadow-2xl text-center transform transition-transform group-hover:scale-[1.01] pointer-events-auto ml-auto mr-8 lg:mx-auto"
          >
            {/* Enter Badge */}
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-slate-950 transition-all shadow-lg">
              <MousePointer2 className="w-7 h-7" />
            </div>

            <h2 className="text-xl font-bold text-white mb-1 tracking-tight">
              Interactive Digital Tour
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              Click anywhere to start first-person walkthrough with full physical wall collisions
            </p>

            {/* Controls Instructions Card */}
            <div className="grid grid-cols-2 gap-2.5 text-left mb-5 text-xs bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 font-mono font-bold text-[11px] min-w-[3.5rem] text-center">
                  W A S D
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Move</div>
                  <div className="text-[10px] text-slate-400">Walk corridors & rooms</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 font-mono font-bold text-[11px] min-w-[3.5rem] text-center">
                  MOUSE
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Look</div>
                  <div className="text-[10px] text-slate-400">360° architectural view</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 font-mono font-bold text-[11px] min-w-[3.5rem] text-center">
                  SHIFT
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Sprint</div>
                  <div className="text-[10px] text-slate-400">Hold to accelerate</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 font-mono font-bold text-[11px] min-w-[3.5rem] text-center">
                  M
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Map</div>
                  <div className="text-[10px] text-slate-400">Open detailed CAD map</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 font-mono font-bold text-[11px] min-w-[3.5rem] text-center">
                  C / R
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Actions</div>
                  <div className="text-[10px] text-slate-400">Ceiling / Reset position</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sky-400 font-mono font-bold text-[11px] min-w-[3.5rem] text-center">
                  ESC
                </div>
                <div>
                  <div className="font-semibold text-slate-200">Release</div>
                  <div className="text-[10px] text-slate-400">Pause mouse lock</div>
                </div>
              </div>
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-3">
              <button
                id="click-to-enter-btn"
                onClick={onEnterFirstPerson}
                className="flex-1 py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm tracking-wide transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2"
              >
                <Footprints className="w-4 h-4" />
                Start Walkthrough
              </button>

              <button
                id="open-map-intro-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDetailedMap(true);
                }}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Navigation className="w-4 h-4 text-sky-400" />
                Detailed Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Navigation Map Modal */}
      <DetailedMapModal
        isOpen={showDetailedMap}
        floorPlan={floorPlan}
        playerPos={playerPos}
        onClose={() => setShowDetailedMap(false)}
        onTeleport={onTeleport}
      />

      {/* Floor Plan Schema Inspector Modal */}
      <FloorPlanInspector
        floorPlan={floorPlan}
        isOpen={showJsonInspector}
        onClose={() => setShowJsonInspector(false)}
      />
    </>
  );
}
