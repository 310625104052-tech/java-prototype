export interface WallData {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness?: number; // meters, default 0.25 for exterior, 0.15 for interior
  height?: number;    // meters, default 2.8
  type?: 'exterior' | 'interior';
  color?: string;
}

export interface DoorData {
  id: string;
  wallId?: string;
  x: number;          // center X in blueprint meters
  y: number;          // center Y in blueprint meters
  width: number;      // opening width (e.g. 0.9m)
  height?: number;    // opening height (e.g. 2.1m)
  orientation: 'horizontal' | 'vertical';
  name?: string;
  isOpen?: boolean;
}

export interface WindowData {
  id: string;
  wallId?: string;
  x: number;          // center X in blueprint meters
  y: number;          // center Y in blueprint meters
  width: number;      // window width (e.g. 1.4m)
  height?: number;    // window height (e.g. 1.2m)
  sillHeight?: number;// distance from floor to window bottom (e.g. 0.9m)
  orientation: 'horizontal' | 'vertical';
}

export interface StairData {
  id: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  flightDirection?: 'up' | 'down' | 'both';
  name?: string;
}

export interface RoomData {
  id: string;
  name: string;
  x: number;          // top-left X
  y: number;          // top-left Y
  width: number;      // room width
  height: number;     // room depth
  polygon?: [number, number][]; // optional polygon boundary
  floorType?: 'hardwood' | 'ceramic' | 'marble' | 'carpet' | 'slate';
  color?: string;
  type?: 'classroom' | 'lab' | 'office' | 'seminar' | 'corridor' | 'stairs' | 'restroom' | 'concourse' | 'general';
  areaM2?: number;
  capacity?: string;
  code?: string;
}

export interface FloorPlanData {
  name: string;
  description: string;
  unit: 'meters';
  floorLevel?: string; // e.g. "Floor 2" or "Level 2"
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  defaultWallHeight: number;
  defaultExteriorThickness: number;
  defaultInteriorThickness: number;
  spawnPoint: {
    x: number;
    y: number;
    z?: number;
    yaw?: number;
  };
  walls: WallData[];
  doors: DoorData[];
  windows: WindowData[];
  rooms: RoomData[];
  stairs?: StairData[];
}
