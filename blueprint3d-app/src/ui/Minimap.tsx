import { memo } from 'react';
import { Compass, Maximize2 } from 'lucide-react';
import { FloorPlanData } from '../types/floorplan';
import { LocationSystem } from '../navigation/LocationSystem';

interface MinimapProps {
  floorPlan: FloorPlanData;
  playerPos: { x: number; z: number; yaw: number };
  onTeleport?: (x: number, y: number) => void;
  onOpenDetailedMap?: () => void;
}

interface StaticPlanProps {
  floorPlan: FloorPlanData;
  activeRoomId?: string;
  margin: number;
  planWidth: number;
  planHeight: number;
}

/**
 * Static architectural plan geometry memoized to ensure 60 FPS without SVG DOM diffing on every frame.
 */
const StaticMinimapPlan = memo(function StaticMinimapPlan({
  floorPlan,
  activeRoomId,
  margin,
  planWidth,
  planHeight,
}: StaticPlanProps) {
  const { bounds, rooms, walls, doors, windows } = floorPlan;

  return (
    <>
      <defs>
        <pattern id="mini-draft-grid" width="2" height="2" patternUnits="userSpaceOnUse">
          <path
            d="M 2 0 L 0 0 0 2"
            fill="none"
            stroke="rgba(25, 71, 229, 0.08)"
            strokeWidth="0.05"
          />
        </pattern>
      </defs>

      <rect
        x={bounds.minX - margin}
        y={bounds.minY - margin}
        width={planWidth + margin * 2}
        height={planHeight + margin * 2}
        fill="#f6f2ea"
      />
      <rect
        x={bounds.minX - margin}
        y={bounds.minY - margin}
        width={planWidth + margin * 2}
        height={planHeight + margin * 2}
        fill="url(#mini-draft-grid)"
      />

      {/* Rooms */}
      {rooms.map((room) => {
        const isInside = activeRoomId === room.id;
        return (
          <g key={room.id}>
            {room.polygon && room.polygon.length >= 3 ? (
              <polygon
                points={room.polygon.map(([px, py]) => `${px},${py}`).join(' ')}
                fill={isInside ? 'rgba(25, 71, 229, 0.16)' : 'rgba(255, 253, 249, 0.85)'}
                stroke={isInside ? '#1947e5' : 'rgba(20, 35, 48, 0.18)'}
                strokeWidth={isInside ? '0.12' : '0.05'}
              />
            ) : (
              <rect
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={isInside ? 'rgba(25, 71, 229, 0.16)' : 'rgba(255, 253, 249, 0.85)'}
                stroke={isInside ? '#1947e5' : 'rgba(20, 35, 48, 0.18)'}
                strokeWidth={isInside ? '0.12' : '0.05'}
              />
            )}
            <text
              x={room.x + room.width / 2}
              y={room.y + room.height / 2}
              fill={isInside ? '#1947e5' : '#536573'}
              fontSize={Math.max(0.45, Math.min(0.75, Math.min(planWidth, planHeight) * 0.045))}
              fontWeight="600"
              textAnchor="middle"
              dominantBaseline="middle"
              className="pointer-events-none"
            >
              {room.code || room.name.split(' ')[0]}
            </text>
          </g>
        );
      })}

      {/* Walls */}
      {walls.map((wall) => (
        <line
          key={wall.id}
          x1={wall.x1}
          y1={wall.y1}
          x2={wall.x2}
          y2={wall.y2}
          stroke={wall.type === 'exterior' ? '#142330' : '#3a5064'}
          strokeWidth={wall.thickness || 0.24}
          strokeLinecap="square"
        />
      ))}

      {/* Windows */}
      {windows.map((win) => (
        <rect
          key={win.id}
          x={win.orientation === 'horizontal' ? win.x - win.width / 2 : win.x - 0.12}
          y={win.orientation === 'horizontal' ? win.y - 0.12 : win.y - win.width / 2}
          width={win.orientation === 'horizontal' ? win.width : 0.24}
          height={win.orientation === 'horizontal' ? 0.24 : win.width}
          fill="#1947e5"
        />
      ))}

      {/* Doors */}
      {doors.map((door) => (
        <circle
          key={door.id}
          cx={door.x}
          cy={door.y}
          r={door.width / 2}
          fill="rgba(217, 72, 38, 0.22)"
          stroke="#d94826"
          strokeWidth="0.07"
        />
      ))}
    </>
  );
});

export const Minimap = memo(function Minimap({
  floorPlan,
  playerPos,
  onTeleport,
  onOpenDetailedMap,
}: MinimapProps) {
  const { bounds } = floorPlan;

  const planWidth = Math.max(1, bounds.maxX - bounds.minX);
  const planHeight = Math.max(1, bounds.maxY - bounds.minY);

  const margin = Math.max(planWidth, planHeight) * 0.08;
  const viewBox = `${bounds.minX - margin} ${bounds.minY - margin} ${planWidth + margin * 2} ${planHeight + margin * 2}`;

  const locationInfo = LocationSystem.getLocationInfo(
    playerPos.x,
    playerPos.z,
    playerPos.yaw,
    floorPlan
  );

  return (
    <aside className="studio-minimap" aria-label="Live architectural minimap">
      <div className="studio-minimap-header">
        <div className="studio-minimap-title">
          <span className="studio-live-dot" aria-hidden="true" />
          <span>PLAN RADAR</span>
        </div>

        <div className="studio-minimap-meta">
          <span className="studio-minimap-heading">
            <Compass size={12} aria-hidden="true" />
            <span id="studio-minimap-facing-val">
              {locationInfo.facing.cardinal} · {locationInfo.facing.degrees}°
            </span>
          </span>
          {onOpenDetailedMap && (
            <button
              id="expand-minimap-btn"
              type="button"
              onClick={onOpenDetailedMap}
              title="Open Full Architectural Sheet [M]"
              className="studio-minimap-expand"
            >
              <Maximize2 size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="studio-minimap-viewport">
        <svg
          viewBox={viewBox}
          className="studio-minimap-svg"
          onClick={(e) => {
            if (!onTeleport) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickFracX = (e.clientX - rect.left) / rect.width;
            const clickFracY = (e.clientY - rect.top) / rect.height;
            const targetX = bounds.minX - margin + clickFracX * (planWidth + margin * 2);
            const targetY = bounds.minY - margin + clickFracY * (planHeight + margin * 2);

            if (
              targetX >= bounds.minX &&
              targetX <= bounds.maxX &&
              targetY >= bounds.minY &&
              targetY <= bounds.maxY
            ) {
              onTeleport(targetX, targetY);
            }
          }}
        >
          <StaticMinimapPlan
            floorPlan={floorPlan}
            activeRoomId={locationInfo.room?.id}
            margin={margin}
            planWidth={planWidth}
            planHeight={planHeight}
          />

          {/* Dynamic Player Marker & Vision Cone */}
          <g id="studio-minimap-marker" transform={`translate(${playerPos.x}, ${playerPos.z})`}>
            <path
              id="studio-minimap-cone"
              d="M 0 0 L -1.25 -2.6 L 1.25 -2.6 Z"
              fill="rgba(217, 72, 38, 0.24)"
              stroke="rgba(217, 72, 38, 0.75)"
              strokeWidth="0.06"
              transform={`rotate(${(-playerPos.yaw * 180) / Math.PI})`}
            />
            <circle r="0.36" fill="#d94826" stroke="#fffdf9" strokeWidth="0.1" />
            <circle r="0.12" fill="#fffdf9" />
          </g>
        </svg>
      </div>

      <div className="studio-minimap-footer">
        <span id="studio-minimap-room" className="studio-minimap-room">{locationInfo.roomName}</span>
        <span id="studio-minimap-coords" className="studio-minimap-coords">
          {playerPos.x.toFixed(1)}m · {playerPos.z.toFixed(1)}m
        </span>
      </div>
    </aside>
  );
});
