// Exercise the production scheduler with a deterministic frame queue; no GPU is needed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let nextFrame = 0;
const frames = new Map();
const listeners = new Map();
const document = {
  hidden: false,
  addEventListener(name, callback) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(callback);
  },
  removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
};
function dispatch(name) { for (const callback of listeners.get(name) || []) callback(); }
let frameTime = 0;
function tick(delta = 1000 / 60) {
  const entry = frames.entries().next().value;
  assert.ok(entry, 'a frame must be pending');
  frames.delete(entry[0]);
  frameTime += delta;
  entry[1](frameTime);
}
class Renderer {
  domElement = {};
  shadowMap = {};
  renders = 0;
  setSize() {}
  setPixelRatio(value) { this.pixelRatio = value; }
  render() { this.renders++; }
  dispose() { this.disposed = true; }
  forceContextLoss() { this.contextLost = true; }
}
class Timer {
  resets = 0;
  updates = 0;
  reset() { this.resets++; }
  update() { this.updates++; }
  dispose() { this.disposed = true; }
  getDelta() { return 1 / 60; }
}
class Orbit extends THREE.EventDispatcher {
  target = new THREE.Vector3();
  dampingFrames = 0;
  update() {
    if (this.dampingFrames-- > 0) this.dispatchEvent({ type: 'change' });
  }
  dispose() {}
}
class Controller {
  isLocked = false;
  updates = 0;
  constructor(camera) { this.camera = camera; }
  setPosition(x, y, z) { this.camera.position.set(x, y, z); }
  exitLock() { this.isLocked = false; }
  update() { this.updates++; }
  setCollisionSystem() {}
  dispose() {}
}
class PlanRenderer {
  rootGroup = new THREE.Group();
  build() {}
  dispose() {}
  setCeilingVisible() {}
  toggleCeiling() { return true; }
}
class Collision { setBounds() {} }
const mocks = {
  three: { ...THREE, WebGLRenderer: Renderer, Timer },
  'three/addons/controls/OrbitControls.js': { OrbitControls: Orbit },
  '../navigation/CollisionSystem': { CollisionSystem: Collision },
  '../navigation/FirstPersonController': { FirstPersonController: Controller },
  './FloorPlanRenderer': { FloorPlanRenderer: PlanRenderer },
};
const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/scene/SceneManager.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, {
  exports: exportsObject,
  require(name) { assert.ok(mocks[name], `unexpected dependency ${name}`); return mocks[name]; },
  document, window: { devicePixelRatio: 2 },
  ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} },
  requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
  cancelAnimationFrame(id) { frames.delete(id); },
});
const container = {
  clientWidth: 800, clientHeight: 600,
  appendChild(child) { child.parentElement = this; },
  removeChild(child) { child.parentElement = null; },
};
const manager = new exportsObject.SceneManager(container, {
  bounds: { minX: 100, minY: 200, maxX: 130, maxY: 220 },
  spawnPoint: { x: 105, y: 205 },
});
assert.equal(frames.size, 0, 'construction must not start a render loop');
assert.equal(manager.renderer.pixelRatio, 1.5);
assert.equal(manager.sunLight.target.position.x, 115, 'initial uploaded plans retain fitted lighting');
manager.setOverview(true);
manager.start();
tick();
assert.equal(manager.renderer.renders, 1);
assert.equal(manager.timer.updates, 1, 'timer updates before every rendered frame');
assert.equal(frames.size, 0, 'a stationary overview must stop scheduling frames');
for (let n = 0; n < 100; n++) manager.invalidate();
assert.equal(frames.size, 1, 'input bursts share one frame');
tick();
manager.orbit.dampingFrames = 4;
manager.orbit.dispatchEvent({ type: 'change' });
for (let n = 0; n < 5; n++) tick();
assert.equal(frames.size, 0, 'orbit damping must run to completion and then sleep');
manager.setOverview(false);
manager.controller.isLocked = true;
dispatch('pointerlockchange');
tick(); tick();
assert.equal(manager.controller.updates, 2, 'walking continues updating');
assert.equal(frames.size, 1);
const renderedBefore = manager.renderer.renders;
for (let n = 0; n < 120; n++) tick(1000 / 120);
assert.ok(Math.abs(manager.renderer.renders - renderedBefore - 60) <= 1, '120 Hz callbacks should be paced to 60 rendered frames');
container.clientWidth = 2560; container.clientHeight = 1440;
manager.resizeObserver.callback([{ contentRect: { width: 2560, height: 1440 } }]);
const budgetRatio = manager.renderer.pixelRatio;
assert.ok(budgetRatio <= Math.sqrt(1500000 / (2560 * 1440)), 'large displays stay within the pixel budget');
for (let n = 0; n < 60; n++) tick(1000 / 30);
assert.equal(manager.currentFps, 30, 'FPS reports actual rendered frames');
const slowRatio = manager.renderer.pixelRatio;
assert.ok(slowRatio < budgetRatio, 'slow devices reduce 3D resolution');
for (let n = 0; n < 60; n++) tick(1000 / 60);
const settledRatio = manager.renderer.pixelRatio;
for (let n = 0; n < 240; n++) tick(1000 / 60);
assert.equal(manager.currentFps, 60);
assert.ok(manager.renderer.pixelRatio > settledRatio && manager.renderer.pixelRatio <= budgetRatio, 'quality recovers after the mixed-rate window clears and 60 FPS is sustained');
document.hidden = true;
dispatch('visibilitychange');
assert.equal(frames.size, 0, 'hidden tabs cancel pending work');
const resetsBeforeResume = manager.timer.resets;
manager.invalidate();
assert.equal(frames.size, 0, 'hidden tabs cannot wake the loop');
document.hidden = false;
dispatch('visibilitychange');
tick();
manager.controller.isLocked = false;
dispatch('pointerlockchange');
tick();
assert.equal(frames.size, 0, 'pausing walking lets the loop sleep');
manager.controller.setPosition(120, 1.65, 210);
manager.invalidate();
tick();
assert.equal(manager.camera.position.x, 120, 'teleports render while paused');
manager.invalidate();
manager.stop();
assert.equal(frames.size, 0);
manager.start();
tick();
assert.equal(frames.size, 0, 'restart renders once without restoring an idle loop');
container.clientWidth = 0;
manager.invalidate();
tick();
assert.equal(frames.size, 0, 'zero-sized views sleep without rendering');
container.clientWidth = 800;
manager.resizeObserver.callback([{ contentRect: { width: 800, height: 600 } }]);
assert.equal(frames.size, 1, 'a resize wakes a previously hidden view');
tick();
manager.dispose();
assert.equal([...listeners.values()].reduce((sum, set) => sum + set.size, 0), 0);
assert.ok(manager.renderer.contextLost);
assert.ok(manager.timer.disposed);
assert.equal(manager.renderer.domElement.parentElement, null);
console.log('PASS: idle, damping, coalescing, walking, hidden tab, teleport, restart, lighting and cleanup.');
