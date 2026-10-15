import { WallDetectionResult } from '../types/blueprint';
import { FloorPlanData, WallData, DoorData, WindowData, RoomData } from '../types/floorplan';

/**
 * Converts detected 2D structural blueprint data into a full 3D navigable FloorPlanData model.
 * Applies metric scale calibration (pixels -> meters), coordinate centering,
 * and academic space configuration.
 */
export function convertDetectionToFloorPlan(result: WallDetectionResult): FloorPlanData {
  const ppm = result.scale?.pixelsPerMeter || 40.0;

  // 1. Determine bounding box in image pixels to normalize origin
  let minPxX = Infinity;
  let minPxY = Infinity;
  let maxPxX = -Infinity;
  let maxPxY = -Infinity;

  for (const w of result.walls) {
    minPxX = Math.min(minPxX, w.x1, w.x2);
    minPxY = Math.min(minPxY, w.y1, w.y2);
    maxPxX = Math.max(maxPxX, w.x1, w.x2);
    maxPxY = Math.max(maxPxY, w.y1, w.y2);
  }

  if (minPxX === Infinity) {
    minPxX = 0;
    minPxY = 0;
    maxPxX = result.image_width || 800;
    maxPxY = result.image_height || 600;
  }

  const originX = minPxX;
  const originY = minPxY;

  // 2. Convert walls to metric coordinates (meters)
  const walls: WallData[] = result.walls.map((w, index) => {
    const x1 = Math.round(((w.x1 - originX) / ppm) * 100) / 100;
    const y1 = Math.round(((w.y1 - originY) / ppm) * 100) / 100;
    const x2 = Math.round(((w.x2 - originX) / ppm) * 100) / 100;
    const y2 = Math.round(((w.y2 - originY) / ppm) * 100) / 100;

    const rawThickMeters = (w.thickness || 12) / ppm;
    const thickness = Math.max(0.15, Math.min(0.40, Math.round(rawThickMeters * 100) / 100));

    return {
      id: w.id || `wall-${index + 1}`,
      x1,
      y1,
      x2,
      y2,
      thickness,
      height: 3.2,
      type: w.wallType === 'exterior' ? 'exterior' : 'interior',
      color: w.wallType === 'exterior' ? '#334155' : '#cbd5e1',
    };
  });

  // 3. Convert openings (doors & windows)
  const doors: DoorData[] = [];
  const windows: WindowData[] = [];

  const openingsList = result.openings || [];
  openingsList.forEach((op, index) => {
    const x = Math.round(((op.x - originX) / ppm) * 100) / 100;
    const y = Math.round(((op.y - originY) / ppm) * 100) / 100;
    const rawWidthM = op.width / ppm;
    const width = Math.max(0.85, Math.min(2.4, Math.round(rawWidthM * 100) / 100));

    if (op.type === 'window') {
      windows.push({
        id: op.id || `window-${index + 1}`,
        wallId: op.wallId,
        x,
        y,
        width,
        height: 1.5,
        sillHeight: 0.9,
        orientation: op.orientation === 'vertical' ? 'vertical' : 'horizontal',
      });
    } else {
      doors.push({
        id: op.id || `door-${index + 1}`,
        wallId: op.wallId,
        x,
        y,
        width,
        height: 2.3,
        orientation: op.orientation === 'vertical' ? 'vertical' : 'horizontal',
        name: op.subType === 'double_door' ? 'Double Access Door' : 'Faculty / Lab Door',
        isOpen: false,
      });
    }
  });

  // 4. Convert rooms
  const roomsList = result.rooms || [];
  const rooms: RoomData[] = roomsList.map((r, index) => {
    const rawX = (r.x !== undefined ? r.x : r.bbox?.x) || 0;
    const rawY = (r.y !== undefined ? r.y : r.bbox?.y) || 0;
    const rawW = (r.width !== undefined ? r.width : r.bbox?.width) || 40;
    const rawH = (r.height !== undefined ? r.height : r.bbox?.height) || 40;

    const x = Math.round(((rawX - originX) / ppm) * 100) / 100;
    const y = Math.round(((rawY - originY) / ppm) * 100) / 100;
    const width = Math.round((rawW / ppm) * 100) / 100;
    const height = Math.round((rawH / ppm) * 100) / 100;

    let floorType: 'hardwood' | 'ceramic' | 'marble' | 'carpet' | 'slate' = 'slate';
    if (r.type === 'lab' || r.type === 'classroom') floorType = 'ceramic';
    else if (r.type === 'lecture_hall') floorType = 'hardwood';
    else if (r.type === 'office') floorType = 'carpet';
    else if (r.type === 'restroom' || r.type === 'stairwell') floorType = 'marble';

    return {
      id: r.id || `room-${index + 1}`,
      name: r.name || `Room ${index + 1}`,
      x,
      y,
      width,
      height,
      floorType,
      color: r.color || '#475569',
    };
  });

  // 5. Calculate bounds & optimal spawn point
  const boundsMaxX = Math.round(((maxPxX - originX) / ppm) * 100) / 100;
  const boundsMaxY = Math.round(((maxPxY - originY) / ppm) * 100) / 100;

  // Find corridor room or center of building to spawn player
  const corridor = rooms.find((r) => r.name.toLowerCase().includes('corridor'));
  let spawnX = boundsMaxX / 2;
  let spawnY = boundsMaxY / 2;

  if (corridor) {
    spawnX = corridor.x + corridor.width / 2;
    spawnY = corridor.y + corridor.height / 2;
  }

  return {
    name: 'College Building Floor Twin',
    description: `Generated from uploaded blueprint: ${result.filename} with ${walls.length} structural walls, ${doors.length} doors, and ${rooms.length} educational spaces.`,
    unit: 'meters',
    bounds: {
      minX: 0,
      minY: 0,
      maxX: Math.max(boundsMaxX, 10),
      maxY: Math.max(boundsMaxY, 10),
    },
    defaultWallHeight: 3.2,
    defaultExteriorThickness: 0.28,
    defaultInteriorThickness: 0.16,
    spawnPoint: {
      x: Math.round(spawnX * 10) / 10,
      y: Math.round(spawnY * 10) / 10,
      z: 1.65,
      yaw: 0,
    },
    walls,
    doors,
    windows,
    rooms,
  };
}
