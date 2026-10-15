export interface UploadedBlueprint {
  file?: File;
  fileName: string;
  previewUrl: string;
  width: number;
  height: number;
  fileSize?: string;
  mimeType?: string;
}

export interface WallRegion {
  id: string;
  parentWallId?: string;
  polygon?: [number, number][]; // Closed contour boundary [x, y] in image px
  centerline: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  thickness: number;          // Estimated thickness in pixels
  thicknessMeters?: number;   // Metric thickness (e.g. 0.25m or 0.18m)
  length: number;             // Length in pixels
  lengthMeters?: number;      // Metric length in meters
  orientation: 'horizontal' | 'vertical' | 'diagonal';
  confidence: number;         // 0.0 - 1.0 structural confidence
  wallType: 'exterior' | 'interior' | 'partition';
  connectedJunctions?: string[];
  openings?: string[];        // Attached door/window IDs
}

// Backwards-compatible DetectedWall interface (extends with centerline coordinates)
export interface DetectedWall {
  id?: string;
  parentWallId?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  thicknessMeters?: number;
  length?: number;
  lengthMeters?: number;
  orientation?: 'horizontal' | 'vertical' | 'diagonal';
  confidence?: number;
  wallType?: 'exterior' | 'interior' | 'partition';
  polygon?: [number, number][];
}

export interface OpeningData {
  id: string;
  type: 'door' | 'window' | 'opening';
  subType?: 'single_door' | 'double_door' | 'sliding_door' | 'exterior_window' | 'corridor_opening';
  x: number;          // Center X in pixels
  y: number;          // Center Y in pixels
  xMeters?: number;   // Center X in 3D world meters
  yMeters?: number;   // Center Y in 3D world meters
  width: number;      // Opening width in pixels
  widthMeters: number;// Opening width in meters (~0.9m for doors, ~1.4m for windows)
  heightMeters: number; // Door height (~2.1m) or window height (~1.2m)
  sillHeightMeters?: number; // Distance from floor (0 for doors, ~0.9m for windows)
  orientation: 'horizontal' | 'vertical';
  wallId?: string;
  confidence: number;
}

export interface RoomDetection {
  id: string;
  name: string;       // e.g. "Lecture Hall 101", "Computer Lab A", "Central Corridor", "Faculty Office"
  type: 'classroom' | 'lab' | 'corridor' | 'office' | 'stairwell' | 'restroom' | 'hall' | 'utility' | 'lecture_hall';
  polygon: [number, number][]; // Closed polygon coordinates in image pixels
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bboxMeters?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  areaPixels: number;
  areaM2: number;     // Floor area in square meters
  floorType: 'hardwood' | 'ceramic' | 'marble' | 'slate' | 'carpet';
  color: string;
}

export interface StaircaseData {
  id: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bboxMeters?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  stepCount: number;
  direction: 'north' | 'south' | 'east' | 'west';
}

export interface ScaleCalibration {
  pixelsPerMeter: number;
  source: 'door_width_calibration' | 'dimension_notation' | 'building_envelope' | 'estimated';
  confidence: number;
  doorWidthPxAvg?: number;
  status: 'calibrated' | 'estimated';
  referenceMeters?: number;
}

export interface TopologyJunction {
  id: string;
  x: number;
  y: number;
  xMeters?: number;
  yMeters?: number;
  type: 'L' | 'T' | 'X' | 'end';
  connectedWallIds: string[];
}

export interface TopologyGraph {
  junctions: TopologyJunction[];
  connectedComponentsCount: number;
  closedLoopsCount: number;
}

export interface PipelineDebugLayers {
  original_image?: string;       // Base64
  preprocessed_image?: string;   // Normalized / Contrast adjusted
  structural_mask?: string;      // Morphologically cleaned solid wall mask
  wall_polygons_image?: string;  // Wall regions with polygon contours
  centerlines_image?: string;    // Centerline vectors + thickness bounds
  openings_image?: string;       // Doors (blue) and windows (cyan) overlay
  rooms_image?: string;          // Room segmentation flood-fill overlay
  final_2d_image?: string;       // Clean architectural 2D model with color-coded elements
  rejection_mask_image?: string; // Filtered non-wall elements (text, symbols, furniture)
}

export interface PipelineCounts {
  raw_regions_count?: number;
  wall_regions_count?: number;
  doors_count?: number;
  windows_count?: number;
  rooms_count?: number;
  junctions_count?: number;
  raw_hough_count?: number;
  after_length_filter_count?: number;
  after_text_filter_count?: number;
  after_parallel_merging_count?: number;
  after_structural_filter_count?: number;
  final_physical_wall_count: number;
  physical_wall_group_count?: number;
  final_segment_count?: number;
}

export interface WallDetectionResult {
  success: boolean;
  error?: string;
  filename: string;
  content_type?: string;
  size_bytes: number;
  // Core structural geometry
  walls: DetectedWall[];
  wall_regions?: WallRegion[];
  openings?: OpeningData[];
  doors?: OpeningData[];
  windows?: OpeningData[];
  rooms?: RoomDetection[];
  stairs?: StaircaseData[];
  scale?: ScaleCalibration;
  topology?: TopologyGraph;
  wall_count: number;
  image_width: number;
  image_height: number;
  pipeline_counts?: PipelineCounts;
  // Visual debug layers for Test Mode approval
  debug_layers?: PipelineDebugLayers;
  debug_image: string; // Base64 data:image/png;base64,...
  raw_hough_image?: string;
  binary_image: string;
  parameters?: {
    [key: string]: any;
  };
}

