import { Maximize2, Compass } from 'lucide-react';
import { FloorPlanData } from '../types/floorplan';
import { LocationSystem } from '../navigation/LocationSystem';

interface MinimapProps {
  floorPlan: FloorPlanData;
  playerPos: { x: number; z: number; yaw: number };
  onTeleport?: (x: number, y: number) => void;
  onOpenDetailedMap?: () => void;
}

export function Minimap({
  floorPlan,
  playerPos,
  onTeleport,
  onOpenDetailedMap,
}: MinimapProps) {
  const { bounds, rooms, walls, doors, windows } = floorPlan;

  const planWidth = bounds.maxX - bounds.minX;
  const planHeight = bounds.maxY - bounds.minY;

  // SVG viewBox with margin
  const margin = 1.0;
  const viewBox = `${bounds.minX - margin} ${bounds.minY - margin} ${planWidth + margin * 2} ${planHeight + margin * 2}`;

  // Current room & location detection
  const locationInfo = LocationSystem.getLocationInfo(
    playerPos.x,
    playerPos.z,
    playerPos.yaw,
    floorPlan
  );

  return (
    <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl text-xs w-72 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/60 text-slate-300">
        <div className="flex items-center gap-1.5 font-semibold text-sky-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Live Blueprint</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Compass Readout */}
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 bg-slate-800/80 px-1.5 py-0.5 rounded">
            <Compass className="w-3 h-3 text-sky-400" />
            {locationInfo.facing.label}
          </span>

          {/* Expand to Detailed Map */}
          {onOpenDetailedMap && (
            <button
              id="expand-minimap-btn"
              onClick={onOpenDetailedMap}
              title="Expand Detailed Navigation Map [Key: M]"
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SVG Minimap Canvas */}
      <div className="relative w-full aspect-[12/7.5] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner">
        <svg
          viewBox={viewBox}
          className="w-full h-full cursor-crosshair"
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
          {/* Grid Background */}
          <defs>
            <pattern id="mini-grid" width="2" height="2" patternUnits="userSpaceOnUse">
              <path d="M 2 0 L 0 0 0 2" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.06" />
            </pattern>
          </defs>
          <rect
            x={bounds.minX - margin}
            y={bounds.minY - margin}
            width={planWidth + margin * 2}
            height={planHeight + margin * 2}
            fill="url(#mini-grid)"
          />

          {/* Rooms */}
          {rooms.map((room) => {
            const isInside = locationInfo.room?.id === room.id;
            const isStairs = room.type === 'stairs' || room.name.toLowerCase().includes('stair');

            return (
              <g key={room.id}>
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  fill={
                    isInside
                      ? 'rgba(56, 189, 248, 0.28)'
                      : isStairs
                      ? 'rgba(15, 23, 42, 0.6)'
                      : 'rgba(255, 255, 255, 0.04)'
                  }
                  stroke={isInside ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}
                  strokeWidth={isInside ? '0.1' : '0.04'}
                />

                {/* Room label */}
                <text
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2}
                  fill={isInside ? '#ffffff' : '#94a3b8'}
                  fontSize="0.65"
                  fontWeight="600"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none font-sans"
                >
                  {room.code || (room.width > 6 ? room.name : room.name.split(' ')[0])}
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
              stroke={wall.type === 'exterior' ? '#f8fafc' : '#cbd5e1'}
              strokeWidth={wall.thickness || 0.25}
              strokeLinecap="square"
            />
          ))}

          {/* Doors */}
          {doors.map((door) => (
            <circle
              key={door.id}
              cx={door.x}
              cy={door.y}
              r={door.width / 2}
              fill="rgba(245, 158, 11, 0.45)"
              stroke="#f59e0b"
              strokeWidth="0.08"
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
              fill="#38bdf8"
            />
          ))}

          {/* Player Marker & Vision Cone */}
          <g transform={`translate(${playerPos.x}, ${playerPos.z})`}>
            {/* Field of View Cone */}
            <path
              d="M 0 0 L -1.2 -2.4 L 1.2 -2.4 Z"
              fill="rgba(56, 189, 248, 0.4)"
              stroke="rgba(56, 189, 248, 0.8)"
              strokeWidth="0.05"
              transform={`rotate(${(-playerPos.yaw * 180) / Math.PI})`}
            />
            {/* Player Body Dot */}
            <circle r="0.32" fill="#0284c7" stroke="#ffffff" strokeWidth="0.09" />
            <circle r="0.12" fill="#ffffff" />
          </g>
        </svg>
      </div>

      {/* Current Location Badge */}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-300">
        <span className="font-semibold text-white truncate max-w-[160px]">
          {locationInfo.roomName}
        </span>
        <span className="font-mono text-slate-400 text-[10px]">
          {playerPos.x.toFixed(1)}m, {playerPos.z.toFixed(1)}m
        </span>
      </div>
    </div>
  );
}
