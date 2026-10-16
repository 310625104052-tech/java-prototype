import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { convertDetectionToFloorPlan } from '../src/utils/detectionToFloorPlan';
import { polygonSlab } from '../src/scene/PolygonGeometry';
import { tracedFloorPlan } from '../src/utils/tracedFloorPlan';
import { CollisionSystem } from '../src/navigation/CollisionSystem';

// Signed tetrahedron volumes verify hole triangulation and X/Y -> X/Z mapping.
function volume(g: ReturnType<typeof polygonSlab>) {
 const p=g.getAttribute('position'); let v=0;
 for(let i=0;i<p.count;i+=3) {
  const ax=p.getX(i),ay=p.getY(i),az=p.getZ(i);
  const bx=p.getX(i+1),by=p.getY(i+1),bz=p.getZ(i+1);
  const cx=p.getX(i+2),cy=p.getY(i+2),cz=p.getZ(i+2);
  v+=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
 }
 return Math.abs(v);
}
const traced=tracedFloorPlan([[0,0],[400,0],[400,100],[100,100],[100,300],[0,300]],[],[[200,0]],4);
assert.equal(traced.doors.length,1);
assert.equal(traced.rooms.length,0,'Manual tracing must not invent room labels');
assert.equal(traced.walls.length,6);
const tracedSlab=polygonSlab(traced.shell!.footprint[0],0,.1);
assert.ok(Math.abs(volume(tracedSlab)-.6)<1e-6,'Traced concave footprint must preserve its notch');
const tracedCollisions=new CollisionSystem();
for(const polygon of traced.shell!.collision) for(const ring of [polygon.outer,...polygon.holes]) ring.forEach(([x,y],i)=>{
 const b=ring[(i+1)%ring.length];tracedCollisions.addObstacle(x,y,b[0],b[1],.001);
});
assert.equal(tracedCollisions.resolvePosition(traced.doors[0].x,traced.doors[0].y).collided,false,'Traced doorway must remain clear');
assert.equal(tracedCollisions.resolvePosition(traced.spawnPoint.x,traced.spawnPoint.y).collided,false,'Traced spawn needs clearance');
const lFloor=polygonSlab({outer:[[0,0],[4,0],[4,1],[1,1],[1,3],[0,3]],holes:[]},-.1,.1);
assert.ok(Math.abs(volume(lFloor)-.6)<1e-6, 'Concave floor must not fill its bounding rectangle');
const courtyard=polygonSlab({outer:[[0,0],[10,0],[10,8],[0,8]],holes:[[[2,2],[2,6],[8,6],[8,2]]]},0,3.2);
assert.ok(Math.abs(volume(courtyard)-56*3.2)<1e-3, 'Wall holes must remain empty after extrusion');
for (const file of process.argv.slice(2)) {
 const result=JSON.parse(fs.readFileSync(file,'utf8'));
 const plan=convertDetectionToFloorPlan(result);
 assert.equal(plan.source,'detected');
 assert.equal(plan.rooms.length,result.rooms.length);
 for(let i=0;i<plan.rooms.length;i++) assert.equal(plan.rooms[i].polygon!.length,result.rooms[i].polygon.length);
 for(const o of [...plan.doors,...plan.windows]) {
  const original=result.openings.find((v:{id:string})=>v.id===o.id);
  assert.ok(Math.abs(o.width-original.width/result.scale.pixelsPerMeter)<1e-8,'Opening width was distorted');
 }
 const collision=new CollisionSystem();
 for(const polygon of plan.shell!.collision) for(const ring of [polygon.outer,...polygon.holes]) {
  ring.forEach(([x,y],i)=>{const b=ring[(i+1)%ring.length];collision.addObstacle(x,y,b[0],b[1],.001);});
 }
 const spawn=collision.resolvePosition(plan.spawnPoint.x,plan.spawnPoint.y);
 assert.ok(!spawn.collided, 'Spawn point must have walking clearance');
 for(const door of plan.doors) {
  const pos=collision.resolvePosition(door.x,door.y);
  assert.ok(Math.hypot(pos.x-door.x,pos.z-door.y)<.03, `Door ${door.id} center is blocked by collision walls`);
 }
 let vertices=0;
 for(const layer of plan.shell!.layers) for(const polygon of layer.polygons) {
  const g=polygonSlab(polygon,layer.bottom,layer.top-layer.bottom);
  g.computeBoundingBox(); const b=g.boundingBox!;
  assert.ok(Math.abs(b.min.y-layer.bottom)<1e-5 && Math.abs(b.max.y-layer.top)<1e-5);
  assert.ok(volume(g)>0);
  assert.ok(b.min.x>=-1e-5 && b.max.x<=plan.bounds.maxX+1e-5);
  assert.ok(b.min.z>=-1e-5 && b.max.z<=plan.bounds.maxY+1e-5);
  for(const x of g.getAttribute('position').array) assert.ok(Number.isFinite(x));
  vertices+=g.getAttribute('position').count;g.dispose();
 }
 console.log(path.basename(file),`${vertices} finite mesh vertices; openings, room polygons and bounds preserved`);
}
console.log('Geometry regressions passed.');
