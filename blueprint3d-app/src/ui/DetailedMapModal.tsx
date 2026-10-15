import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Navigation,
  Compass,
  Layers,
  MapPin,
  Move,
  Maximize2,
  Minimize2,
  Info,
} from 'lucide-react';
import { FloorPlanData, RoomData } from '../types/floorplan';
import { LocationSystem } from '../navigation/LocationSystem';

interface DetailedMapModalProps {
  isOpen: boolean;
  floorPlan: FloorPlanData;
  playerPos: { x: number; z: number; yaw: number };
  onClose: () => void;
  onTeleport: (x: number, y: number) => void;
}

export function DetailedMapModal({
  isOpen,
  floorPlan,
  playerPos,
  onClose,
  onTeleport,
}: DetailedMapModalProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedRoom, setSelectedRoom] = useState<RoomData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const { bounds, rooms, walls, doors, windows, stairs, name, floorLevel } = floorPlan;
  const planWidth = bounds.maxX - bounds.minX;
  const planHeight = bounds.maxY - bounds.minY;

  // Margin around building
  const margin = 2.5;
  const viewBoxX = bounds.minX - margin;
  const viewBoxY = bounds.minY - margin;
  const viewBoxW = planWidth + margin * 2;
  const viewBoxH = planHeight + margin * 2;

  // Live Location
  const locationInfo = LocationSystem.getLocationInfo(
    playerPos.x,
    playerPos.z,
    playerPos.yaw,
    floorPlan
  );

  // Reset zoom & pan when opening
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      if (locationInfo.room) {
        setSelectedRoom(locationInfo.room);
      }
    }
  }, [isOpen]);

  // Handle ESC or M key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' || e.code === 'KeyM') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left button only
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.88;
    setZoom((prev) => Math.max(0.6, Math.min(3.5, prev * factor)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl h-[90vh] bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-slate-950/70 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-sm">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white tracking-tight">{name}</h2>
                <span className="text-xs font-semibold uppercase px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  {floorLevel || 'Level 2'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>Architectural Floor Plan & Live Location Map</span>
                <span>•</span>
                <span className="font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Synchronized
                </span>
              </p>
            </div>
          </div>

          {/* Controls & Close Button */}
          <div className="flex items-center gap-2.5">
            {/* Compass Heading */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-mono text-slate-300">
              <Compass className="w-4 h-4 text-sky-400" />
              <span>
                Heading: <strong className="text-white">{locationInfo.facing.label}</strong> ({locationInfo.facing.degrees}°)
              </span>
            </div>

            {/* Close Button */}
            <button
              id="close-detailed-map-btn"
              onClick={onClose}
              title="Close Map [Key: M or ESC]"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="relative flex-1 flex overflow-hidden bg-slate-950">
          {/* SVG Map Canvas Viewport */}
          <div
            ref={containerRef}
            className="flex-1 h-full cursor-grab active:cursor-grabbing overflow-hidden relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <svg
                viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
                className="w-full h-full max-h-full"
                style={{ filter: 'drop-shadow(0 20px 30px rgba(0,0,0,0.6))' }}
              >
                {/* SVG Definitions */}
                <defs>
                  {/* Architectural Blueprint Grid Pattern */}
                  <pattern id="arch-grid-small" width="1" height="1" patternUnits="userSpaceOnUse">
                    <path d="M 1 0 L 0 0 0 1" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.03" />
                  </pattern>
                  <pattern id="arch-grid-large" width="5" height="5" patternUnits="userSpaceOnUse">
                    <rect width="5" height="5" fill="url(#arch-grid-small)" />
                    <path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(56,189,248,0.08)" strokeWidth="0.06" />
                  </pattern>
                </defs>

                {/* Outer Grounds Backdrop */}
                <rect
                  x={viewBoxX}
                  y={viewBoxY}
                  width={viewBoxW}
                  height={viewBoxH}
                  fill="#030712"
                />
                <rect
                  x={viewBoxX}
                  y={viewBoxY}
                  width={viewBoxW}
                  height={viewBoxH}
                  fill="url(#arch-grid-large)"
                />

                {/* Building Slab Outline */}
                <rect
                  x={bounds.minX}
                  y={bounds.minY}
                  width={planWidth}
                  height={planHeight}
                  fill="#0f172a"
                  stroke="#1e293b"
                  strokeWidth="0.1"
                />

                {/* Rooms Layer */}
                {rooms.map((room) => {
                  const isCurrent = locationInfo.room?.id === room.id;
                  const isSelected = selectedRoom?.id === room.id;
                  const isCorridor = room.type === 'corridor' || room.name.toLowerCase().includes('corridor');
                  const isStairs = room.type === 'stairs' || room.name.toLowerCase().includes('stair');

                  let fillColor = 'rgba(30, 41, 59, 0.45)';
                  let strokeColor = 'rgba(71, 85, 105, 0.5)';

                  if (isCurrent) {
                    fillColor = 'rgba(14, 165, 233, 0.22)';
                    strokeColor = '#38bdf8';
                  } else if (isSelected) {
                    fillColor = 'rgba(99, 102, 241, 0.2)';
                    strokeColor = '#818cf8';
                  } else if (isCorridor) {
                    fillColor = 'rgba(51, 65, 85, 0.35)';
                    strokeColor = 'rgba(100, 116, 139, 0.4)';
                  } else if (isStairs) {
                    fillColor = 'rgba(15, 23, 42, 0.7)';
                    strokeColor = 'rgba(148, 163, 184, 0.5)';
                  }

                  return (
                    <g
                      key={room.id}
                      className="cursor-pointer transition-opacity hover:opacity-90"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoom(room);
                      }}
                    >
                      {/* Room Bounds */}
                      <rect
                        x={room.x}
                        y={room.y}
                        width={room.width}
                        height={room.height}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={isCurrent || isSelected ? '0.12' : '0.05'}
                        rx="0.08"
                      />

                      {/* Current Room Pulsing Border */}
                      {isCurrent && (
                        <rect
                          x={room.x + 0.08}
                          y={room.y + 0.08}
                          width={room.width - 0.16}
                          height={room.height - 0.16}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="0.04"
                          strokeDasharray="0.3 0.2"
                        />
                      )}

                      {/* Stairs Tread Lines if Stairwell */}
                      {isStairs && (
                        <g>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((step) => {
                            const stepY = room.y + (step * room.height) / 10;
                            return (
                              <line
                                key={`stair-step-${step}`}
                                x1={room.x + 0.4}
                                y1={stepY}
                                x2={room.x + room.width - 0.4}
                                y2={stepY}
                                stroke="rgba(148, 163, 184, 0.4)"
                                strokeWidth="0.04"
                              />
                            );
                          })}
                          {/* Directional arrow */}
                          <path
                            d={`M ${room.x + room.width / 2} ${room.y + room.height - 0.8} L ${room.x + room.width / 2} ${room.y + 0.8} M ${room.x + room.width / 2 - 0.3} ${room.y + 1.2} L ${room.x + room.width / 2} ${room.y + 0.8} L ${room.x + room.width / 2 + 0.3} ${room.y + 1.2}`}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="0.08"
                          />
                          <text
                            x={room.x + room.width / 2}
                            y={room.y + room.height - 0.4}
                            fill="#38bdf8"
                            fontSize="0.4"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            UP
                          </text>
                        </g>
                      )}

                      {/* Room Labels & Room Code */}
                      {!isStairs && (
                        <g className="pointer-events-none">
                          {room.code && (
                            <text
                              x={room.x + room.width / 2}
                              y={room.y + room.height / 2 - 0.4}
                              fill={isCurrent ? '#38bdf8' : '#94a3b8'}
                              fontSize="0.42"
                              fontWeight="bold"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {room.code}
                            </text>
                          )}
                          <text
                            x={room.x + room.width / 2}
                            y={room.y + room.height / 2 + (room.code ? 0.25 : 0)}
                            fill={isCurrent ? '#ffffff' : '#e2e8f0'}
                            fontSize={room.width > 8 ? '0.62' : '0.48'}
                            fontWeight="600"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            {room.name}
                          </text>
                          {room.areaM2 && room.height > 4 && (
                            <text
                              x={room.x + room.width / 2}
                              y={room.y + room.height / 2 + 0.9}
                              fill="#64748b"
                              fontSize="0.38"
                              textAnchor="middle"
                            >
                              {room.areaM2} m²
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Windows (Architectural double glass lines) */}
                {windows.map((win) => {
                  const isHoriz = win.orientation === 'horizontal';
                  const w = isHoriz ? win.width : 0.22;
                  const h = isHoriz ? 0.22 : win.width;
                  const x = isHoriz ? win.x - win.width / 2 : win.x - 0.11;
                  const y = isHoriz ? win.y - 0.11 : win.y - win.width / 2;

                  return (
                    <g key={win.id}>
                      <rect x={x} y={y} width={w} height={h} fill="#0284c7" />
                      <line
                        x1={isHoriz ? x : win.x}
                        y1={isHoriz ? win.y : y}
                        x2={isHoriz ? x + w : win.x}
                        y2={isHoriz ? win.y : y + h}
                        stroke="#ffffff"
                        strokeWidth="0.04"
                      />
                    </g>
                  );
                })}

                {/* Doors (Opening gaps and swing arcs) */}
                {doors.map((door) => {
                  const r = door.width;
                  return (
                    <g key={door.id}>
                      {/* Door threshold clearance */}
                      <circle
                        cx={door.x}
                        cy={door.y}
                        r={door.width / 2}
                        fill="rgba(245, 158, 11, 0.25)"
                      />
                      {/* Door swing arc */}
                      <path
                        d={`M ${door.x - door.width / 2} ${door.y} A ${door.width / 2} ${door.width / 2} 0 0 1 ${door.x} ${door.y - door.width / 2}`}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="0.06"
                        strokeDasharray="0.1 0.1"
                      />
                      {/* Door panel edge */}
                      <line
                        x1={door.x - door.width / 2}
                        y1={door.y}
                        x2={door.x - door.width / 2}
                        y2={door.y - door.width / 2}
                        stroke="#f59e0b"
                        strokeWidth="0.08"
                      />
                    </g>
                  );
                })}

                {/* Walls (Highest layer for sharp architectural drafting) */}
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

                {/* Player Position & Vision Cone */}
                <g transform={`translate(${playerPos.x}, ${playerPos.z})`}>
                  {/* Field of View Cone */}
                  <path
                    d="M 0 0 L -1.5 -3.2 L 1.5 -3.2 Z"
                    fill="rgba(56, 189, 248, 0.35)"
                    stroke="rgba(56, 189, 248, 0.7)"
                    strokeWidth="0.04"
                    transform={`rotate(${(-playerPos.yaw * 180) / Math.PI})`}
                  />

                  {/* Pulsing Outer Ping */}
                  <circle r="0.8" fill="none" stroke="#38bdf8" strokeWidth="0.05" opacity="0.6">
                    <animate attributeName="r" values="0.4;1.2" dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0" dur="1.8s" repeatCount="indefinite" />
                  </circle>

                  {/* Player Body Dot */}
                  <circle r="0.32" fill="#0284c7" stroke="#ffffff" strokeWidth="0.09" />
                  <circle r="0.14" fill="#ffffff" />

                  {/* "YOU ARE HERE" Pin Label */}
                  <g transform="translate(0, 0.9)">
                    <rect
                      x="-1.6"
                      y="0"
                      width="3.2"
                      height="0.65"
                      rx="0.3"
                      fill="#0284c7"
                      stroke="#ffffff"
                      strokeWidth="0.05"
                    />
                    <text
                      x="0"
                      y="0.42"
                      fill="#ffffff"
                      fontSize="0.34"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      YOU ARE HERE
                    </text>
                  </g>
                </g>
              </svg>
            </div>

            {/* Scale Bar (Bottom Left of Canvas) */}
            <div className="absolute bottom-4 left-4 z-10 px-3 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs text-slate-300 flex items-center gap-3 shadow-lg">
              <span className="text-[11px] text-slate-400 font-medium">CAD Scale:</span>
              <div className="flex flex-col items-center">
                <div className="flex justify-between w-28 text-[9px] font-mono text-slate-400">
                  <span>0</span>
                  <span>5m</span>
                  <span>10m</span>
                </div>
                <div className="w-28 h-1.5 bg-slate-700 border border-slate-600 rounded-sm flex">
                  <div className="w-1/2 h-full bg-slate-300"></div>
                  <div className="w-1/2 h-full bg-slate-500"></div>
                </div>
              </div>
            </div>

            {/* Canvas Zoom & Reset Controls (Top Right of Canvas) */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 p-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 shadow-lg">
              <button
                onClick={() => setZoom((prev) => Math.min(3.5, prev * 1.25))}
                title="Zoom In"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom((prev) => Math.max(0.6, prev * 0.8))}
                title="Zoom Out"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={resetView}
                title="Reset View"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Sidebar: Selected Room Inspector & Wayfinding Card */}
          <aside className="w-80 bg-slate-900/95 border-l border-slate-800 flex flex-col p-5 overflow-y-auto">
            {/* Live Location Summary */}
            <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-500/30 mb-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-400 uppercase tracking-wider mb-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                Current Live Location
              </div>
              <div className="text-base font-bold text-white mb-1">{locationInfo.roomName}</div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>{locationInfo.floorLevel}</span>
                <span className="font-mono text-sky-300">{locationInfo.coordinatesFormatted}</span>
              </div>
            </div>

            {/* Room Inspector Details */}
            {selectedRoom ? (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Room Details
                  </span>
                  {selectedRoom.code && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs font-bold">
                      {selectedRoom.code}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-bold text-white mb-1">{selectedRoom.name}</h3>
                <p className="text-xs text-slate-400 capitalize mb-4">
                  Type: <span className="text-slate-200 font-medium">{selectedRoom.type || 'Academic Space'}</span>
                </p>

                <div className="grid grid-cols-2 gap-2.5 mb-5 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Area</span>
                    <span className="font-bold text-white text-sm">
                      {selectedRoom.areaM2 || Math.round(selectedRoom.width * selectedRoom.height)} m²
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Dimensions</span>
                    <span className="font-mono text-white text-xs font-medium">
                      {selectedRoom.width.toFixed(1)}m × {selectedRoom.height.toFixed(1)}m
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 col-span-2">
                    <span className="text-slate-400 block text-[11px]">Function / Capacity</span>
                    <span className="font-medium text-sky-300 text-xs">
                      {selectedRoom.capacity || 'Standard Operational Capacity'}
                    </span>
                  </div>
                </div>

                {/* Teleport / Navigate Button */}
                <button
                  id="teleport-selected-room-btn"
                  onClick={() => {
                    const targetX = selectedRoom.x + selectedRoom.width / 2;
                    const targetY = selectedRoom.y + selectedRoom.height / 2;
                    onTeleport(targetX, targetY);
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2 mb-4"
                >
                  <Navigation className="w-4 h-4" />
                  Teleport to {selectedRoom.name}
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <Info className="w-8 h-8 text-slate-500 mb-2" />
                <p className="text-xs">Click any room or corridor on the map to inspect architectural details and navigate.</p>
              </div>
            )}

            {/* Quick Rooms Directory List */}
            <div className="mt-auto pt-4 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                Floor Directory
              </span>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1 text-xs">
                {rooms.map((r) => (
                  <button
                    key={`list-${r.id}`}
                    onClick={() => setSelectedRoom(r)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                      selectedRoom?.id === r.id
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate pr-2">{r.name}</span>
                    {r.code && <span className="text-[10px] font-mono text-slate-400">{r.code}</span>}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Legend Footer */}
        <footer className="px-6 py-3 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-slate-300">Legend:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 bg-white rounded-full"></span>
              Exterior Wall
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 bg-slate-300 rounded-full"></span>
              Interior Wall
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm"></span>
              Door Opening
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-sky-500 rounded-full"></span>
              Window
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-slate-700 border border-slate-500 rounded-sm"></span>
              Stairwell (Egress)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-sky-400 rounded-full animate-pulse"></span>
              Current Position
            </span>
          </div>

          <div className="text-[11px] text-slate-400">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold">M</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold">ESC</kbd> to return to 3D Walkthrough
          </div>
        </footer>
      </div>
    </div>
  );
}
