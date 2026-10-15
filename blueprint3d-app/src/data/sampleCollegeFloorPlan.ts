import { FloorPlanData } from '../types/floorplan';

/**
 * Procedural 3D College Campus Building (Level 2 Science & Technology Complex).
 * Features:
 * - Lecture Hall 201 (14m x 7m) with stadium seating & double doors
 * - AI & Robotics Lab 202 (14m x 7m)
 * - Electronics & Hardware Lab 203 (12m x 7m)
 * - Faculty Research Office 204 (6m x 7m)
 * - Seminar & Conference Room 205 (6m x 7m)
 * - Restroom & Utilities Core 206 (4m x 7m)
 * - North & South Stairwells (4m x 7m each)
 * - Main 32m Arterial College Corridor with Slate Flooring
 */
export const sampleCollegeFloorPlan: FloorPlanData = {
  name: 'College Science & Technology Complex',
  description: 'Academic floorplan with 120-seat Lecture Hall, AI Robotics Lab, Electronics Lab, Seminar Rooms, and Concourse.',
  unit: 'meters',
  floorLevel: 'Floor 2',
  bounds: {
    minX: 0,
    minY: 0,
    maxX: 32,
    maxY: 17,
  },
  defaultWallHeight: 3.2, // College academic floor ceiling height is 3.2m
  defaultExteriorThickness: 0.35, // Thick structural concrete facade
  defaultInteriorThickness: 0.20, // Interior partition blocks
  spawnPoint: {
    x: 16.0,
    y: 8.5,  // Center of the main arterial corridor
    z: 1.65, // Eye level
    yaw: 0,
  },
  rooms: [
    {
      id: 'room-corridor',
      name: 'Main Arterial Corridor',
      code: 'CORR-200',
      type: 'corridor',
      x: 0,
      y: 7,
      width: 32,
      height: 3,
      floorType: 'slate',
      color: '#475569',
      areaM2: 96,
      capacity: 'Primary Circulation',
    },
    {
      id: 'room-lecture-201',
      name: 'Lecture Hall 201',
      code: 'LEC-201',
      type: 'classroom',
      x: 4,
      y: 0,
      width: 14,
      height: 7,
      floorType: 'hardwood',
      color: '#94a3b8',
      areaM2: 98,
      capacity: '120 Seats',
    },
    {
      id: 'room-robotics-202',
      name: 'AI & Robotics Lab 202',
      code: 'LAB-202',
      type: 'lab',
      x: 18,
      y: 0,
      width: 14,
      height: 7,
      floorType: 'ceramic',
      color: '#cbd5e1',
      areaM2: 98,
      capacity: '40 Workstations',
    },
    {
      id: 'room-north-stair',
      name: 'North Stairwell',
      code: 'STR-N',
      type: 'stairs',
      x: 0,
      y: 0,
      width: 4,
      height: 7,
      floorType: 'slate',
      color: '#334155',
      areaM2: 28,
      capacity: 'Emergency Egress',
    },
    {
      id: 'room-electronics-203',
      name: 'Electronics Lab 203',
      code: 'LAB-203',
      type: 'lab',
      x: 4,
      y: 10,
      width: 12,
      height: 7,
      floorType: 'ceramic',
      color: '#cbd5e1',
      areaM2: 84,
      capacity: '32 Benches',
    },
    {
      id: 'room-faculty-204',
      name: 'Faculty Research Office 204',
      code: 'OFF-204',
      type: 'office',
      x: 16,
      y: 10,
      width: 6,
      height: 7,
      floorType: 'carpet',
      color: '#64748b',
      areaM2: 42,
      capacity: '6 Faculty',
    },
    {
      id: 'room-seminar-205',
      name: 'Seminar Room 205',
      code: 'SEM-205',
      type: 'seminar',
      x: 22,
      y: 10,
      width: 6,
      height: 7,
      floorType: 'hardwood',
      color: '#94a3b8',
      areaM2: 42,
      capacity: '24 Seats',
    },
    {
      id: 'room-restroom-206',
      name: 'Restrooms & Utility Core',
      code: 'UTL-206',
      type: 'restroom',
      x: 28,
      y: 10,
      width: 4,
      height: 7,
      floorType: 'marble',
      color: '#e2e8f0',
      areaM2: 28,
      capacity: 'Men / Women / Facilities',
    },
    {
      id: 'room-south-stair',
      name: 'South Stairwell',
      code: 'STR-S',
      type: 'stairs',
      x: 0,
      y: 10,
      width: 4,
      height: 7,
      floorType: 'slate',
      color: '#334155',
      areaM2: 28,
      capacity: 'Emergency Egress',
    },
  ],
  stairs: [
    {
      id: 'stair-north',
      name: 'North Egress Stairs',
      x: 0.5,
      y: 0.5,
      width: 3.0,
      depth: 6.0,
      flightDirection: 'both',
    },
    {
      id: 'stair-south',
      name: 'South Egress Stairs',
      x: 0.5,
      y: 10.5,
      width: 3.0,
      depth: 6.0,
      flightDirection: 'both',
    },
  ],
  walls: [
    // Exterior Perimeter (32m x 17m)
    // North exterior wall (y=0, x=0 to 32)
    { id: 'wall-ext-north', x1: 0, y1: 0, x2: 32, y2: 0, thickness: 0.35, height: 3.2, type: 'exterior' },
    // East exterior wall (x=32, y=0 to 17)
    { id: 'wall-ext-east', x1: 32, y1: 0, x2: 32, y2: 17, thickness: 0.35, height: 3.2, type: 'exterior' },
    // South exterior wall (y=17, x=32 to 0)
    { id: 'wall-ext-south', x1: 32, y1: 17, x2: 0, y2: 17, thickness: 0.35, height: 3.2, type: 'exterior' },
    // West exterior wall (x=0, y=17 to 0)
    { id: 'wall-ext-west', x1: 0, y1: 17, x2: 0, y2: 0, thickness: 0.35, height: 3.2, type: 'exterior' },

    // Main Corridor North Wall (y=7, x=0 to 32)
    { id: 'wall-corridor-north', x1: 0, y1: 7, x2: 32, y2: 7, thickness: 0.22, height: 3.2, type: 'interior' },
    // Main Corridor South Wall (y=10, x=0 to 32)
    { id: 'wall-corridor-south', x1: 0, y1: 10, x2: 32, y2: 10, thickness: 0.22, height: 3.2, type: 'interior' },

    // North Wing Vertical Partitions
    { id: 'wall-north-p1', x1: 4, y1: 0, x2: 4, y2: 7, thickness: 0.20, height: 3.2, type: 'interior' },
    { id: 'wall-north-p2', x1: 18, y1: 0, x2: 18, y2: 7, thickness: 0.20, height: 3.2, type: 'interior' },

    // South Wing Vertical Partitions
    { id: 'wall-south-p1', x1: 4, y1: 10, x2: 4, y2: 17, thickness: 0.20, height: 3.2, type: 'interior' },
    { id: 'wall-south-p2', x1: 16, y1: 10, x2: 16, y2: 17, thickness: 0.20, height: 3.2, type: 'interior' },
    { id: 'wall-south-p3', x1: 22, y1: 10, x2: 22, y2: 17, thickness: 0.20, height: 3.2, type: 'interior' },
    { id: 'wall-south-p4', x1: 28, y1: 10, x2: 28, y2: 17, thickness: 0.20, height: 3.2, type: 'interior' },
  ],
  doors: [
    // Lecture Hall 201 Double Door
    { id: 'door-lecture-201', wallId: 'wall-corridor-north', x: 11.0, y: 7.0, width: 1.8, height: 2.3, orientation: 'horizontal', name: 'Lecture Hall 201' },
    // Robotics Lab 202 Double Door
    { id: 'door-robotics-202', wallId: 'wall-corridor-north', x: 25.0, y: 7.0, width: 1.8, height: 2.3, orientation: 'horizontal', name: 'AI & Robotics Lab' },
    // North Stairwell Door
    { id: 'door-north-stair', wallId: 'wall-corridor-north', x: 2.0, y: 7.0, width: 1.0, height: 2.2, orientation: 'horizontal', name: 'North Egress' },
    // South Stairwell Door
    { id: 'door-south-stair', wallId: 'wall-corridor-south', x: 2.0, y: 10.0, width: 1.0, height: 2.2, orientation: 'horizontal', name: 'South Egress' },
    // Electronics Lab 203 Door
    { id: 'door-electronics-203', wallId: 'wall-corridor-south', x: 10.0, y: 10.0, width: 1.1, height: 2.2, orientation: 'horizontal', name: 'Electronics Lab' },
    // Faculty Office 204 Door
    { id: 'door-faculty-204', wallId: 'wall-corridor-south', x: 19.0, y: 10.0, width: 0.9, height: 2.1, orientation: 'horizontal', name: 'Faculty Office' },
    // Seminar Room 205 Door
    { id: 'door-seminar-205', wallId: 'wall-corridor-south', x: 25.0, y: 10.0, width: 0.9, height: 2.1, orientation: 'horizontal', name: 'Seminar Room' },
    // Restroom Door
    { id: 'door-restroom-206', wallId: 'wall-corridor-south', x: 30.0, y: 10.0, width: 0.9, height: 2.1, orientation: 'horizontal', name: 'Restrooms' },
    // Main Concourse Entrance
    { id: 'door-main-concourse', wallId: 'wall-ext-east', x: 32.0, y: 8.5, width: 2.2, height: 2.4, orientation: 'vertical', name: 'Main Campus Concourse' },
  ],
  windows: [
    // North Facade Ribbon Windows (Lecture Hall & Robotics Lab)
    { id: 'win-north-1', wallId: 'wall-ext-north', x: 8.0, y: 0.0, width: 3.5, height: 1.5, sillHeight: 0.9, orientation: 'horizontal' },
    { id: 'win-north-2', wallId: 'wall-ext-north', x: 14.0, y: 0.0, width: 3.5, height: 1.5, sillHeight: 0.9, orientation: 'horizontal' },
    { id: 'win-north-3', wallId: 'wall-ext-north', x: 22.0, y: 0.0, width: 3.5, height: 1.5, sillHeight: 0.9, orientation: 'horizontal' },
    { id: 'win-north-4', wallId: 'wall-ext-north', x: 28.0, y: 0.0, width: 3.5, height: 1.5, sillHeight: 0.9, orientation: 'horizontal' },

    // South Facade Ribbon Windows (Electronics Lab, Faculty Office, Seminar Room)
    { id: 'win-south-1', wallId: 'wall-ext-south', x: 8.0, y: 17.0, width: 3.2, height: 1.4, sillHeight: 0.9, orientation: 'horizontal' },
    { id: 'win-south-2', wallId: 'wall-ext-south', x: 13.0, y: 17.0, width: 3.2, height: 1.4, sillHeight: 0.9, orientation: 'horizontal' },
    { id: 'win-south-3', wallId: 'wall-ext-south', x: 19.0, y: 17.0, width: 2.6, height: 1.4, sillHeight: 0.9, orientation: 'horizontal' },
    { id: 'win-south-4', wallId: 'wall-ext-south', x: 25.0, y: 17.0, width: 2.6, height: 1.4, sillHeight: 0.9, orientation: 'horizontal' },

    // West Stairwell Windows
    { id: 'win-west-1', wallId: 'wall-ext-west', x: 0.0, y: 3.5, width: 2.0, height: 1.8, sillHeight: 0.8, orientation: 'vertical' },
    { id: 'win-west-2', wallId: 'wall-ext-west', x: 0.0, y: 13.5, width: 2.0, height: 1.8, sillHeight: 0.8, orientation: 'vertical' },
  ],
};
