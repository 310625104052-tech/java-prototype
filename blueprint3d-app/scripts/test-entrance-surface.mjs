import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const code = ts.transpileModule(fs.readFileSync(path.join(app, 'src/scene/FloorPlanRenderer.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(code, {
  exports: exportsObject,
  require(name) { return name === 'three' ? THREE : {}; },
});
// Test actual floor meshes without the canvas-texture or WebGL setup.
const renderer = Object.create(exportsObject.FloorPlanRenderer.prototype);
renderer.rootGroup = new THREE.Group();
renderer.floorPlanData = {
  bounds: { minX: 0, minY: 0, maxX: 12, maxY: 8 },
  rooms: [{ id: 'entry', x: 6, y: 0, width: 3, height: 2 }],
};
renderer.buildFloors();
renderer.rootGroup.updateMatrixWorld(true);
const foundation = renderer.rootGroup.getObjectByName('foundation-slab');
const walkway = renderer.rootGroup.getObjectByName('entrance-walkway');
assert.ok(foundation && walkway);
const foundationBounds = new THREE.Box3().setFromObject(foundation);
const pathBounds = new THREE.Box3().setFromObject(walkway);
assert.ok(pathBounds.min.z < foundationBounds.min.z && pathBounds.max.z > foundationBounds.min.z,
  'fixture must cover the overlapping entrance region');
assert.ok(pathBounds.max.y - foundationBounds.max.y > 0.005,
  'paving must be above the foundation to prevent z-fighting');
assert.ok(Math.abs(pathBounds.max.y - 0.02) < 1e-6, 'paving remains level with finished room floors');
for (const z of [-0.95, -0.5, -0.05]) {
  const ray = new THREE.Raycaster(new THREE.Vector3(7.5, 2, z), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObjects([foundation, walkway]);
  assert.equal(hits[0].object, walkway, `paving must be the visible surface at z=${z}`);
  assert.ok(hits[1].distance - hits[0].distance > 0.005, 'surfaces must have distinct depth values');
}
renderer.dispose();
console.log('PASS: entrance paving clears the foundation and matches finished floor level.');
