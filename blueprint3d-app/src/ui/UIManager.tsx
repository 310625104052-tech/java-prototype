import { useState, memo } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Code2,
  Compass,
  Eye,
  EyeOff,
  Footprints,
  MapPin,
  Navigation,
  Upload,
} from 'lucide-react';
import { StudioMark } from './StudioMark';
import { FloorPlanData } from '../types/floorplan';
import { DetailedMapModal } from './DetailedMapModal';
import { FloorPlanInspector } from './FloorPlanInspector';
import { StartScreen } from './StartScreen';
import { Minimap } from './Minimap';
import { LocationSystem } from '../navigation/LocationSystem';

interface UIManagerProps {
  floorPlan: FloorPlanData;
  hasModel: boolean;
  isOverview: boolean;
  isCeilingVisible?: boolean;
  onToggleCeiling?: () => void;
  onOverview: () => void;
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

export const UIManager = memo(function UIManager({
  floorPlan,
  hasModel,
  isOverview,
  isCeilingVisible = false,
  onToggleCeiling,
  onOverview,
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

  const locationInfo = LocationSystem.getLocationInfo(
    playerPos.x,
    playerPos.z,
    playerPos.yaw,
    floorPlan
  );

  const showReadyCard =
    hasModel && !isOverview && !isLocked && !showDetailedMap && !showJsonInspector;

  const spanW = Math.round(floorPlan.bounds.maxX - floorPlan.bounds.minX);
  const spanD = Math.round(floorPlan.bounds.maxY - floorPlan.bounds.minY);

  return (
    <>
      {!hasModel && <StartScreen onPlanReady={onPlanReady} />}

      {hasModel && isOverview && (
        <>
          <header className="studio-model-toolbar" data-ui>
            <div className="studio-model-identity">
              <StudioMark compact />
              <span className="studio-toolbar-divider" />
              <div>
                <h1 title={modelFileName}>{modelFileName || floorPlan.name}</h1>
                <p>
                  3D axonometric overview · {spanW}m × {spanD}m{' '}
                  <span>Drag to orbit · Scroll to zoom</span>
                </p>
              </div>
            </div>

            <div className="studio-model-actions">
              {onToggleCeiling && (
                <button
                  type="button"
                  className="studio-secondary"
                  aria-pressed={isCeilingVisible}
                  onClick={onToggleCeiling}
                  title="Toggle roof slab visibility"
                >
                  {isCeilingVisible ? (
                    <EyeOff size={15} aria-hidden="true" />
                  ) : (
                    <Eye size={15} aria-hidden="true" />
                  )}
                  <span className="studio-hide-tablet">
                    {isCeilingVisible ? 'Hide roof' : 'Show roof'}
                  </span>
                </button>
              )}
              <button
                type="button"
                className="studio-secondary"
                onClick={() => onShowDetailedMap(true)}
                title="Open 2D architectural plan sheet"
              >
                <Navigation size={15} aria-hidden="true" />
                <span className="studio-hide-tablet">2D Plan</span>
              </button>
              <button
                type="button"
                className="studio-secondary"
                onClick={() => setShowJsonInspector(true)}
                title="Inspect model JSON schema"
              >
                <Code2 size={15} aria-hidden="true" />
                <span className="studio-hide-tablet">Data</span>
              </button>
              <button type="button" className="studio-secondary" onClick={onNewUpload}>
                <Upload size={15} aria-hidden="true" /> Upload another
              </button>
              <button type="button" className="studio-primary" onClick={onEnterFirstPerson}>
                Walk through <ArrowUpRight size={17} aria-hidden="true" />
              </button>
              <span id="studio-overview-fps" className="studio-fps-badge" title="Live rendered FPS">
                60 FPS
              </span>
            </div>
          </header>

          <div className="studio-overview-dock" data-ui>
            <div className="studio-model-summary">
              <span className="studio-summary-dot" aria-hidden="true" />
              {floorPlan.reconstruction === 'traced' ? (
                <>
                  <strong>Traced layout</strong>
                  <span>Scale set manually</span>
                </>
              ) : (
                <>
                  <strong>{floorPlan.rooms.length} detected rooms</strong>
                  <span>
                    {floorPlan.walls.length} walls · {floorPlan.doors.length} doors ·{' '}
                    {isCeilingVisible ? 'Roof shown' : 'Roof cutaway'}
                  </span>
                  {!!floorPlan.importWarnings?.length && (
                    <span className="studio-review-state">Approximate reconstruction</span>
                  )}
                </>
              )}
            </div>

            {floorPlan.rooms.length > 0 && (
              <div className="studio-room-strip" role="group" aria-label="Jump to room">
                {floorPlan.rooms.slice(0, 7).map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    className="studio-room-chip"
                    onClick={() => {
                      onTeleport(room.x + room.width / 2, room.y + room.height / 2);
                      onEnterFirstPerson();
                    }}
                    title={`Step inside ${room.name}`}
                  >
                    <MapPin size={11} aria-hidden="true" />
                    <span>{room.code || room.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="studio-view-compass" aria-hidden="true">
            <div className="studio-compass-ring">
              <Compass size={22} />
            </div>
            <span>ORBIT VIEW</span>
          </div>
        </>
      )}

      {showReadyCard && (
        <div className="studio-pause-overlay">
          <section className="studio-pause-dialog" aria-label="Walkthrough controls" data-ui>
            <div className="studio-pause-top">
              <StudioMark compact />
              <span className="studio-folio-tag">WALKTHROUGH READY</span>
            </div>

            <h1>Step inside.</h1>
            <p className="studio-filename" title={modelFileName}>
              {modelFileName || floorPlan.name}
            </p>

            <dl className="studio-model-facts">
              {[
                ['Walls', floorPlan.walls.length],
                ['Doors', floorPlan.doors.length],
                ['Windows', floorPlan.windows.length],
                ['Rooms', floorPlan.rooms.length],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            {lockError && (
              <div id="pointer-lock-error" role="alert" className="studio-lock-notice">
                {lockError}
              </div>
            )}

            <button
              type="button"
              id="click-to-enter-btn"
              onClick={onEnterFirstPerson}
              className="studio-primary studio-walk-button"
            >
              <Footprints size={18} aria-hidden="true" /> Walk through{' '}
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>

            <p className="studio-pause-hint">
              Current location: <strong>{locationInfo.roomName}</strong> · Use W A S D to move, Esc
              to pause.
            </p>

            <button className="studio-text-button studio-back-to-model" onClick={onOverview}>
              <ArrowLeft size={15} aria-hidden="true" /> Back to 3D overview
            </button>

            <div className="studio-pause-utilities">
              <button type="button" onClick={() => onShowDetailedMap(true)}>
                <Navigation size={15} aria-hidden="true" /> Map
              </button>
              <button type="button" onClick={() => setShowJsonInspector(true)}>
                <Code2 size={15} aria-hidden="true" /> Model data
              </button>
              <button type="button" id="upload-another-btn" onClick={onNewUpload}>
                <Upload size={15} aria-hidden="true" /> New drawing
              </button>
            </div>
          </section>
        </div>
      )}

      {isLocked && (
        <>
          <div className="studio-crosshair" aria-hidden="true">
            <span />
            <span />
          </div>

          <div className="studio-location-hud">
            <span className="studio-hud-dot" aria-hidden="true" />
            <strong id="studio-hud-room">{locationInfo.roomName}</strong>
            <span className="studio-hud-compass">
              <Compass size={14} aria-hidden="true" />
              <span id="studio-hud-facing">{locationInfo.facing.cardinal} · {locationInfo.facing.degrees}°</span>
            </span>
            <span className="studio-hud-divider" aria-hidden="true" />
            <span id="studio-hud-fps" className="studio-hud-fps">Measuring…</span>
          </div>

          <Minimap floorPlan={floorPlan} playerPos={playerPos} />

          <div id="controls-bar" className="studio-walk-controls">
            {CONTROL_HINTS.map((hint) => (
              <span key={hint.label}>
                <kbd>{hint.keys}</kbd>
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
});
