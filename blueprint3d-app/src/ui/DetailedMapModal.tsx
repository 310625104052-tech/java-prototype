import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Info,
  MapPin,
  Navigation,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FloorPlanData, RoomData } from '../types/floorplan';
import { LocationSystem } from '../navigation/LocationSystem';
import { StudioMark } from './StudioMark';

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

  const { bounds, rooms, walls, doors, windows, name, floorLevel } = floorPlan;
  const planWidth = Math.max(1, bounds.maxX - bounds.minX);
  const planHeight = Math.max(1, bounds.maxY - bounds.minY);

  const margin = 2.5;
  const viewBoxX = bounds.minX - margin;
  const viewBoxY = bounds.minY - margin;
  const viewBoxW = planWidth + margin * 2;
  const viewBoxH = planHeight + margin * 2;

  const locationInfo = LocationSystem.getLocationInfo(
    playerPos.x,
    playerPos.z,
    playerPos.yaw,
    floorPlan
  );

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      if (locationInfo.room) {
        setSelectedRoom(locationInfo.room);
      } else if (rooms.length > 0) {
        setSelectedRoom(rooms[0]);
      }
    }
  }, [isOpen]);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
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
    <div className="studio-modal-backdrop" onClick={onClose} data-ui>
      <div
        className="studio-modal-sheet studio-map-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <header className="studio-modal-header">
          <div className="studio-modal-title-group">
            <StudioMark compact />
            <span className="studio-toolbar-divider" aria-hidden="true" />
            <div>
              <div className="studio-modal-kicker">
                ARCHITECTURAL WAYFINDING SHEET // {floorLevel || 'LEVEL 02'}
              </div>
              <h2>{name}</h2>
            </div>
          </div>

          <div className="studio-modal-header-actions">
            <div className="studio-map-heading-pill">
              <Compass size={15} aria-hidden="true" />
              <span>
                Heading <strong>{locationInfo.facing.label}</strong> ({locationInfo.facing.degrees}°)
              </span>
            </div>

            <button
              id="close-detailed-map-btn"
              type="button"
              onClick={onClose}
              title="Close Map [Key: M or ESC]"
              className="studio-icon-button"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="studio-map-body">
          {/* SVG Map Canvas Viewport */}
          <div
            ref={containerRef}
            className="studio-map-canvas"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <div
              className="studio-map-stage"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 160ms cubic-bezier(0.23, 1, 0.32, 1)',
              }}
            >
              <svg
                viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
                className="w-full h-full max-h-full"
              >
                <defs>
                  <pattern id="arch-grid-small" width="1" height="1" patternUnits="userSpaceOnUse">
                    <path
                      d="M 1 0 L 0 0 0 1"
                      fill="none"
                      stroke="rgba(25, 71, 229, 0.06)"
                      strokeWidth="0.03"
                    />
                  </pattern>
                  <pattern id="arch-grid-large" width="5" height="5" patternUnits="userSpaceOnUse">
                    <rect width="5" height="5" fill="url(#arch-grid-small)" />
                    <path
                      d="M 5 0 L 0 0 0 5"
                      fill="none"
                      stroke="rgba(25, 71, 229, 0.12)"
                      strokeWidth="0.05"
                    />
                  </pattern>
                </defs>

                {/* Outer Grounds Backdrop */}
                <rect
                  x={viewBoxX}
                  y={viewBoxY}
                  width={viewBoxW}
                  height={viewBoxH}
                  fill="#f4efe6"
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
                  fill="#fffdf9"
                  stroke="#c5d0dc"
                  strokeWidth="0.1"
                />

                {/* Rooms Layer */}
                {rooms.map((room) => {
                  const isCurrent = locationInfo.room?.id === room.id;
                  const isSelected = selectedRoom?.id === room.id;
                  const isCorridor =
                    room.type === 'corridor' || room.name.toLowerCase().includes('corridor');
                  const isStairs =
                    room.type === 'stairs' || room.name.toLowerCase().includes('stair');

                  let fillColor = '#f7f4ee';
                  let strokeColor = '#b8c6d4';

                  if (isCurrent) {
                    fillColor = '#e2ebff';
                    strokeColor = '#1947e5';
                  } else if (isSelected) {
                    fillColor = '#ebf1ff';
                    strokeColor = '#1947e5';
                  } else if (isCorridor) {
                    fillColor = '#efeae0';
                    strokeColor = '#b4c0cc';
                  } else if (isStairs) {
                    fillColor = '#fbf3ec';
                    strokeColor = '#d94826';
                  }

                  return (
                    <g
                      key={room.id}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRoom(room);
                      }}
                    >
                      {room.polygon && room.polygon.length >= 3 ? (
                        <polygon
                          points={room.polygon.map(([px, py]) => `${px},${py}`).join(' ')}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={isCurrent || isSelected ? '0.14' : '0.06'}
                        />
                      ) : (
                        <rect
                          x={room.x}
                          y={room.y}
                          width={room.width}
                          height={room.height}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeWidth={isCurrent || isSelected ? '0.14' : '0.06'}
                          rx="0.06"
                        />
                      )}

                      {isCurrent && (
                        <rect
                          x={room.x + 0.1}
                          y={room.y + 0.1}
                          width={Math.max(0.2, room.width - 0.2)}
                          height={Math.max(0.2, room.height - 0.2)}
                          fill="none"
                          stroke="#1947e5"
                          strokeWidth="0.045"
                          strokeDasharray="0.3 0.2"
                        />
                      )}

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
                                stroke="rgba(217, 72, 38, 0.35)"
                                strokeWidth="0.045"
                              />
                            );
                          })}
                          <path
                            d={`M ${room.x + room.width / 2} ${room.y + room.height - 0.8} L ${room.x + room.width / 2} ${room.y + 0.8} M ${room.x + room.width / 2 - 0.3} ${room.y + 1.2} L ${room.x + room.width / 2} ${room.y + 0.8} L ${room.x + room.width / 2 + 0.3} ${room.y + 1.2}`}
                            fill="none"
                            stroke="#d94826"
                            strokeWidth="0.08"
                          />
                          <text
                            x={room.x + room.width / 2}
                            y={room.y + room.height - 0.35}
                            fill="#d94826"
                            fontSize="0.38"
                            fontWeight="700"
                            textAnchor="middle"
                          >
                            UP
                          </text>
                        </g>
                      )}

                      {!isStairs && (
                        <g className="pointer-events-none">
                          {room.code && (
                            <text
                              x={room.x + room.width / 2}
                              y={room.y + room.height / 2 - 0.42}
                              fill={isCurrent || isSelected ? '#1947e5' : '#536573'}
                              fontSize="0.4"
                              fontWeight="700"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {room.code}
                            </text>
                          )}
                          <text
                            x={room.x + room.width / 2}
                            y={room.y + room.height / 2 + (room.code ? 0.22 : 0)}
                            fill="#142330"
                            fontSize={room.width > 8 ? '0.6' : '0.46'}
                            fontWeight="600"
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            {room.name}
                          </text>
                          {room.areaM2 && room.height > 3.5 && (
                            <text
                              x={room.x + room.width / 2}
                              y={room.y + room.height / 2 + 0.88}
                              fill="#536573"
                              fontSize="0.36"
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

                {/* Windows */}
                {windows.map((win) => {
                  const isHoriz = win.orientation === 'horizontal';
                  const w = isHoriz ? win.width : 0.24;
                  const h = isHoriz ? 0.24 : win.width;
                  const x = isHoriz ? win.x - win.width / 2 : win.x - 0.12;
                  const y = isHoriz ? win.y - 0.12 : win.y - win.width / 2;

                  return (
                    <g key={win.id}>
                      <rect x={x} y={y} width={w} height={h} fill="#1947e5" />
                      <line
                        x1={isHoriz ? x : win.x}
                        y1={isHoriz ? win.y : y}
                        x2={isHoriz ? x + w : win.x}
                        y2={isHoriz ? win.y : y + h}
                        stroke="#fffdf9"
                        strokeWidth="0.045"
                      />
                    </g>
                  );
                })}

                {/* Doors */}
                {doors.map((door) => (
                  <g key={door.id}>
                    <circle
                      cx={door.x}
                      cy={door.y}
                      r={door.width / 2}
                      fill="rgba(217, 72, 38, 0.16)"
                    />
                    <path
                      d={`M ${door.x - door.width / 2} ${door.y} A ${door.width / 2} ${door.width / 2} 0 0 1 ${door.x} ${door.y - door.width / 2}`}
                      fill="none"
                      stroke="#d94826"
                      strokeWidth="0.06"
                      strokeDasharray="0.12 0.1"
                    />
                    <line
                      x1={door.x - door.width / 2}
                      y1={door.y}
                      x2={door.x - door.width / 2}
                      y2={door.y - door.width / 2}
                      stroke="#d94826"
                      strokeWidth="0.08"
                    />
                  </g>
                ))}

                {/* Structural Walls */}
                {walls.map((wall) => (
                  <line
                    key={wall.id}
                    x1={wall.x1}
                    y1={wall.y1}
                    x2={wall.x2}
                    y2={wall.y2}
                    stroke={wall.type === 'exterior' ? '#142330' : '#435b70'}
                    strokeWidth={wall.thickness || 0.25}
                    strokeLinecap="square"
                  />
                ))}

                {/* Player Position & Vision Cone */}
                <g transform={`translate(${playerPos.x}, ${playerPos.z})`}>
                  <path
                    d="M 0 0 L -1.5 -3.2 L 1.5 -3.2 Z"
                    fill="rgba(217, 72, 38, 0.22)"
                    stroke="rgba(217, 72, 38, 0.72)"
                    strokeWidth="0.045"
                    transform={`rotate(${(-playerPos.yaw * 180) / Math.PI})`}
                  />

                  <circle r="0.34" fill="#d94826" stroke="#fffdf9" strokeWidth="0.09" />
                  <circle r="0.13" fill="#fffdf9" />

                  <g transform="translate(0, 0.85)">
                    <rect
                      x="-1.55"
                      y="0"
                      width="3.1"
                      height="0.62"
                      rx="0.16"
                      fill="#142330"
                      stroke="#fffdf9"
                      strokeWidth="0.04"
                    />
                    <text
                      x="0"
                      y="0.41"
                      fill="#fffdf9"
                      fontSize="0.31"
                      fontWeight="700"
                      letterSpacing="0.04"
                      textAnchor="middle"
                    >
                      YOU ARE HERE
                    </text>
                  </g>
                </g>
              </svg>
            </div>

            {/* Scale Bar (Bottom Left of Canvas) */}
            <div className="studio-map-scalebar">
              <span>SCALE 1:100</span>
              <div className="studio-scale-graphic">
                <div className="studio-scale-labels">
                  <span>0</span>
                  <span>5m</span>
                  <span>10m</span>
                </div>
                <div className="studio-scale-segments">
                  <span />
                  <span />
                </div>
              </div>
            </div>

            {/* Canvas Zoom & Reset Controls (Top Right of Canvas) */}
            <div className="studio-map-zoom-controls">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3.5, prev * 1.25))}
                title="Zoom In"
                className="studio-icon-button"
              >
                <ZoomIn size={16} />
              </button>
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(0.6, prev * 0.8))}
                title="Zoom Out"
                className="studio-icon-button"
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={resetView}
                title="Reset View"
                className="studio-icon-button"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>

          {/* Right Sidebar: Selected Room Inspector & Wayfinding Card */}
          <aside className="studio-map-sidebar">
            <div className="studio-live-card">
              <div className="studio-live-card-kicker">
                <MapPin size={13} aria-hidden="true" />
                <span>CURRENT POSITION</span>
              </div>
              <strong>{locationInfo.roomName}</strong>
              <div className="studio-live-card-meta">
                <span>{locationInfo.floorLevel}</span>
                <span>{locationInfo.coordinatesFormatted}</span>
              </div>
            </div>

            {selectedRoom ? (
              <div className="studio-room-inspector">
                <div className="studio-room-inspector-head">
                  <span>SELECTED SPACE</span>
                  {selectedRoom.code && <kbd>{selectedRoom.code}</kbd>}
                </div>

                <h3>{selectedRoom.name}</h3>
                <p className="studio-room-type">
                  Program: <strong>{selectedRoom.type || 'Architectural Space'}</strong>
                </p>

                <dl className="studio-room-metrics">
                  <div>
                    <dt>Floor Area</dt>
                    <dd>
                      {selectedRoom.areaM2 || Math.round(selectedRoom.width * selectedRoom.height)}{' '}
                      m²
                    </dd>
                  </div>
                  <div>
                    <dt>Span</dt>
                    <dd>
                      {selectedRoom.width.toFixed(1)}m × {selectedRoom.height.toFixed(1)}m
                    </dd>
                  </div>
                  <div className="studio-room-metric-wide">
                    <dt>Occupancy / Spec</dt>
                    <dd>{selectedRoom.capacity || 'Standard ArchitecturalClearance'}</dd>
                  </div>
                </dl>

                <button
                  id="teleport-selected-room-btn"
                  type="button"
                  onClick={() => {
                    const targetX = selectedRoom.x + selectedRoom.width / 2;
                    const targetY = selectedRoom.y + selectedRoom.height / 2;
                    onTeleport(targetX, targetY);
                    onClose();
                  }}
                  className="studio-primary studio-teleport-btn"
                >
                  <Navigation size={15} aria-hidden="true" />
                  <span>Teleport to {selectedRoom.name}</span>
                </button>
              </div>
            ) : (
              <div className="studio-room-empty">
                <Info size={22} aria-hidden="true" />
                <p>Select any room on the drawing to inspect its dimensions and teleport inside.</p>
              </div>
            )}

            <div className="studio-directory">
              <div className="studio-directory-title">SPACE SCHEDULE ({rooms.length})</div>
              <div className="studio-directory-list">
                {rooms.map((r) => (
                  <button
                    key={`list-${r.id}`}
                    type="button"
                    onClick={() => setSelectedRoom(r)}
                    className={`studio-directory-item${
                      selectedRoom?.id === r.id ? ' is-selected' : ''
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    {r.code && <kbd>{r.code}</kbd>}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Legend Footer */}
        <footer className="studio-data-footer">
          <div className="studio-map-legend">
            <strong>LEGEND:</strong>
            <span>
              <i className="legend-swatch legend-swatch--ext" /> Exterior Wall
            </span>
            <span>
              <i className="legend-swatch legend-swatch--int" /> Partition
            </span>
            <span>
              <i className="legend-swatch legend-swatch--door" /> Door Swing
            </span>
            <span>
              <i className="legend-swatch legend-swatch--win" /> Glazing
            </span>
            <span>
              <i className="legend-swatch legend-swatch--pos" /> Live Beacon
            </span>
          </div>

          <div className="studio-map-shortcut-hint">
            Press <kbd>M</kbd> or <kbd>Esc</kbd> to return to 3D space
          </div>
        </footer>
      </div>
    </div>
  );
}
