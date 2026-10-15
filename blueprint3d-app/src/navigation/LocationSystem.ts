import { FloorPlanData, RoomData } from '../types/floorplan';

export interface LocationInfo {
  room: RoomData | null;
  roomName: string;
  roomType: string;
  isCorridor: boolean;
  isStairwell: boolean;
  floorLevel: string;
  facing: {
    cardinal: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
    label: string;
    degrees: number;
  };
  coordinatesFormatted: string;
  statusBadge: string;
}

/**
 * Robust spatial localization engine for the architectural walkthrough.
 * Calculates current room, corridor, facing orientation, and floor in real-time.
 */
export class LocationSystem {
  /**
   * Point in polygon check using ray casting algorithm.
   */
  public static isPointInPolygon(px: number, py: number, polygon: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0];
      const yi = polygon[i][1];
      const xj = polygon[j][0];
      const yj = polygon[j][1];

      const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Point in axis-aligned bounding box.
   */
  public static isPointInBox(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
    return px >= x && px <= x + w && py >= y && py <= y + h;
  }

  /**
   * Converts Three.js camera yaw (in radians) to compass orientation.
   * In standard Three.js convention:
   * Yaw 0 rad looks along -Z (North)
   * Yaw π/2 rad looks along -X (West)
   * Yaw π rad looks along +Z (South)
   * Yaw 3π/2 (-π/2) rad looks along +X (East)
   */
  public static getFacingDirection(yaw: number): {
    cardinal: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
    label: string;
    degrees: number;
  } {
    // Normalize yaw to [0, 2π)
    let angle = (-yaw) % (Math.PI * 2);
    if (angle < 0) angle += Math.PI * 2;

    const degrees = Math.round((angle * 180) / Math.PI) % 360;

    // Sector step is 45 degrees
    // N: 337.5 to 22.5
    if (degrees >= 338 || degrees < 23) {
      return { cardinal: 'N', label: 'North', degrees };
    } else if (degrees >= 23 && degrees < 68) {
      return { cardinal: 'NE', label: 'North-East', degrees };
    } else if (degrees >= 68 && degrees < 113) {
      return { cardinal: 'E', label: 'East', degrees };
    } else if (degrees >= 113 && degrees < 158) {
      return { cardinal: 'SE', label: 'South-East', degrees };
    } else if (degrees >= 158 && degrees < 203) {
      return { cardinal: 'S', label: 'South', degrees };
    } else if (degrees >= 203 && degrees < 248) {
      return { cardinal: 'SW', label: 'South-West', degrees };
    } else if (degrees >= 248 && degrees < 293) {
      return { cardinal: 'W', label: 'West', degrees };
    } else {
      return { cardinal: 'NW', label: 'North-West', degrees };
    }
  }

  /**
   * Identifies the current room or space based on player position.
   */
  public static getCurrentRoom(px: number, pz: number, rooms: RoomData[]): RoomData | null {
    // 1. Check precise polygons first if available
    for (const room of rooms) {
      if (room.polygon && room.polygon.length >= 3) {
        if (this.isPointInPolygon(px, pz, room.polygon)) {
          return room;
        }
      }
    }

    // 2. Check bounding box containment
    // Prioritize non-corridor rooms first, so if a room overlaps corridor boundary by a margin, room wins
    const specificRooms = rooms.filter((r) => !r.name.toLowerCase().includes('corridor') && r.type !== 'corridor');
    for (const room of specificRooms) {
      if (this.isPointInBox(px, pz, room.x, room.y, room.width, room.height)) {
        return room;
      }
    }

    // 3. Check corridor rooms
    const corridorRooms = rooms.filter((r) => r.name.toLowerCase().includes('corridor') || r.type === 'corridor');
    for (const room of corridorRooms) {
      if (this.isPointInBox(px, pz, room.x, room.y, room.width, room.height)) {
        return room;
      }
    }

    // 4. If slightly near an opening or doorway, find closest room within 0.8m margin
    let closestRoom: RoomData | null = null;
    let closestDistSq = 0.8 * 0.8;

    for (const room of rooms) {
      const centerX = room.x + room.width / 2;
      const centerY = room.y + room.height / 2;
      // Clamped distance to box
      const clampedX = Math.max(room.x, Math.min(room.x + room.width, px));
      const clampedY = Math.max(room.y, Math.min(room.y + room.height, pz));
      const distSq = (px - clampedX) ** 2 + (pz - clampedY) ** 2;

      if (distSq < closestDistSq) {
        closestDistSq = distSq;
        closestRoom = room;
      }
    }

    return closestRoom;
  }

  /**
   * Computes complete live location information for HUD, minimap, and navigation map.
   */
  public static getLocationInfo(
    px: number,
    pz: number,
    yaw: number,
    floorPlan: FloorPlanData
  ): LocationInfo {
    const room = this.getCurrentRoom(px, pz, floorPlan.rooms);
    const facing = this.getFacingDirection(yaw);

    const floorLevel = floorPlan.floorLevel || (floorPlan.name.includes('Level') ? 'Level 2' : 'Floor 2');

    let roomName = 'Building Concourse';
    let roomType = 'concourse';
    let isCorridor = false;
    let isStairwell = false;

    if (room) {
      roomName = room.name;
      const lower = room.name.toLowerCase();
      isCorridor = lower.includes('corridor') || lower.includes('hallway') || room.type === 'corridor';
      isStairwell = lower.includes('stair') || room.type === 'stairs';

      if (isCorridor) {
        roomType = 'corridor';
      } else if (isStairwell) {
        roomType = 'stairs';
      } else if (lower.includes('lab')) {
        roomType = 'lab';
      } else if (lower.includes('lecture') || lower.includes('class')) {
        roomType = 'classroom';
      } else if (lower.includes('office') || lower.includes('faculty')) {
        roomType = 'office';
      } else if (lower.includes('restroom') || lower.includes('bath')) {
        roomType = 'restroom';
      } else {
        roomType = room.type || 'general';
      }
    } else {
      // Check if inside building bounds
      const { bounds } = floorPlan;
      if (px >= bounds.minX && px <= bounds.maxX && pz >= bounds.minY && pz <= bounds.maxY) {
        roomName = 'Main Concourse';
      } else {
        roomName = 'Building Grounds';
      }
    }

    const coordinatesFormatted = `X: ${px.toFixed(1)}m, Y: ${pz.toFixed(1)}m`;
    const statusBadge = `YOU ARE HERE: ${roomName.toUpperCase()}`;

    return {
      room,
      roomName,
      roomType,
      isCorridor,
      isStairwell,
      floorLevel,
      facing,
      coordinatesFormatted,
      statusBadge,
    };
  }
}
