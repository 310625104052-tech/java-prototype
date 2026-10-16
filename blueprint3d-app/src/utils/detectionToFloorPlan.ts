import type { WallDetectionResult } from '../types/blueprint';
import type { FloorPlanData, PlanPolygon } from '../types/floorplan';

/** Preserve the detector's one coordinate system for walls, floors and openings. */
export function convertDetectionToFloorPlan(result: WallDetectionResult): FloorPlanData {
  if (!result.shell?.layers.length) throw new Error('The server did not return connected building geometry. Restart the backend and upload again.');
  const ppm = result.scale?.pixelsPerMeter || 40;
  const points = result.shell?.footprint.flatMap(p => p.outer)
    ?? result.walls.flatMap(w => [[w.x1, w.y1], [w.x2, w.y2]]);
  const originX = Math.min(...points.map(p => p[0]));
  const originY = Math.min(...points.map(p => p[1]));
  const point = ([x, y]: number[]): [number, number] => [(x-originX)/ppm, (y-originY)/ppm];
  const polygon = (p: PlanPolygon): PlanPolygon => ({outer: p.outer.map(point), holes: p.holes.map(h => h.map(point))});
  const shell = result.shell ? {
    layers: result.shell.layers.map(l => ({...l, polygons: l.polygons.map(polygon)})),
    collision: result.shell.collision.map(polygon),
    footprint: result.shell.footprint.map(polygon),
    spawn: {x: (result.shell.spawn.x-originX)/ppm, y: (result.shell.spawn.y-originY)/ppm},
  } : undefined;
  const walls = result.walls.map((w, i) => ({
    id: w.id || `wall-${i+1}`, x1: (w.x1-originX)/ppm, y1: (w.y1-originY)/ppm,
    x2: (w.x2-originX)/ppm, y2: (w.y2-originY)/ppm, thickness: (w.thickness || 12)/ppm,
    height: 3.2, type: w.wallType === 'exterior' ? 'exterior' as const : 'interior' as const,
  }));
  const opening = (op: NonNullable<WallDetectionResult['openings']>[number]) => ({
    id: op.id, wallId: op.wallId, x: (op.x-originX)/ppm, y: (op.y-originY)/ppm,
    width: op.width/ppm, orientation: op.orientation,
  });
  const doors = (result.openings || []).filter(o => o.type !== 'window').map(o => ({
    ...opening(o), height: 2.3, name: 'Door', isOpen: true,
  }));
  const windows = (result.openings || []).filter(o => o.type === 'window').map(o => ({
    ...opening(o), height: 1.5, sillHeight: .9,
  }));
  const rooms = (result.rooms || []).map((r, i) => ({
    id: r.id, name: `Room ${i+1}`, x: ((r.x ?? r.bbox?.x ?? 0)-originX)/ppm,
    y: ((r.y ?? r.bbox?.y ?? 0)-originY)/ppm,
    width: (r.width ?? r.bbox?.width ?? 0)/ppm, height: (r.height ?? r.bbox?.height ?? 0)/ppm,
    polygon: r.polygon?.map(point), type: 'general' as const,
    floorType: 'ceramic' as const, color: '#ded9d2', areaM2: r.areaM2,
  }));
  const spawn = shell?.spawn ?? {x: rooms[0]?.x + rooms[0]?.width/2 || 1, y: rooms[0]?.y + rooms[0]?.height/2 || 1};
  return {
    source: 'detected', shell, importWarnings: result.import_info?.warnings, name: result.filename || 'Uploaded floor plan',
    description: 'Reconstructed from the uploaded structural floor plan. Scale is estimated from opening widths.',
    unit: 'meters', bounds: {minX: 0, minY: 0,
      maxX: (Math.max(...points.map(p => p[0]))-originX)/ppm,
      maxY: (Math.max(...points.map(p => p[1]))-originY)/ppm},
    defaultWallHeight: 3.2, defaultExteriorThickness: .25, defaultInteriorThickness: .15,
    spawnPoint: {...spawn, z: 1.65, yaw: 0}, walls, doors, windows, rooms,
  };
}
