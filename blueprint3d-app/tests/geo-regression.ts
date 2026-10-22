import assert from 'node:assert/strict';
import {
  planToMap,
  gazeBearing,
  getPlanStorageKey,
  loadPlanMapState,
  lookupSite,
  savePlanMapState,
  type PlanMapState,
} from '../src/utils/geoMap';
import type { FloorPlanData } from '../src/types/floorplan';

function assertClose(actual: number, expected: number, msg?: string, eps = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) < eps,
    `${msg ?? 'Values not close'}: expected ${expected}, got ${actual} (diff: ${Math.abs(actual - expected)})`
  );
}

function assertPointClose(actual: [number, number], expected: [number, number], msg?: string, eps = 1e-6) {
  assertClose(actual[0], expected[0], `${msg ?? 'Point mismatch'} [east/x]`, eps);
  assertClose(actual[1], expected[1], `${msg ?? 'Point mismatch'} [north/y]`, eps);
}

// ---------------------------------------------------------------------------
// Suite A: Plan-to-map coordinate transformation (`planToMap`)
// ---------------------------------------------------------------------------
console.log('Testing Suite A: Plan-to-map coordinate transformation (planToMap)...');

// In blueprint coordinates:
// x grows rightwards (east in standard orientation),
// y grows downwards (so "top" of plan has smaller/negative y relative to centre).
// At bearing 0°: top points north (+y on map), right points east (+x on map).
const origin = { x: 0, y: 0 };

// 1. Bearing 0°:
// Top point (0, -10) -> [0, 10] (North)
assertPointClose(planToMap(0, -10, origin, 0), [0, 10], 'Bearing 0° top points north (+y)');
// Right point (10, 0) -> [10, 0] (East)
assertPointClose(planToMap(10, 0, origin, 0), [10, 0], 'Bearing 0° right points east (+x)');
// Bottom point (0, 10) -> [0, -10] (South)
assertPointClose(planToMap(0, 10, origin, 0), [0, -10], 'Bearing 0° bottom points south (-y)');
// Left point (-10, 0) -> [-10, 0] (West)
assertPointClose(planToMap(-10, 0, origin, 0), [-10, 0], 'Bearing 0° left points west (-x)');
// Centre point (0, 0) -> [0, 0]
assertPointClose(planToMap(0, 0, origin, 0), [0, 0], 'Bearing 0° centre maps to [0, 0]');

// 2. Bearing 90°: quarter turn clockwise
// Top (0, -10) was North -> now East [10, 0]
assertPointClose(planToMap(0, -10, origin, 90), [10, 0], 'Bearing 90° top turns east');
// Right (10, 0) was East -> now South [0, -10]
assertPointClose(planToMap(10, 0, origin, 90), [0, -10], 'Bearing 90° right turns south');
// Bottom (0, 10) was South -> now West [-10, 0]
assertPointClose(planToMap(0, 10, origin, 90), [-10, 0], 'Bearing 90° bottom turns west');
// Left (-10, 0) was West -> now North [0, 10]
assertPointClose(planToMap(-10, 0, origin, 90), [0, 10], 'Bearing 90° left turns north');

// 3. Bearing 180°: half turn
// Top (0, -10) was North -> now South [0, -10]
assertPointClose(planToMap(0, -10, origin, 180), [0, -10], 'Bearing 180° top turns south');
// Right (10, 0) was East -> now West [-10, 0]
assertPointClose(planToMap(10, 0, origin, 180), [-10, 0], 'Bearing 180° right turns west');
// Bottom (0, 10) was South -> now North [0, 10]
assertPointClose(planToMap(0, 10, origin, 180), [0, 10], 'Bearing 180° bottom turns north');
// Left (-10, 0) was West -> now East [10, 0]
assertPointClose(planToMap(-10, 0, origin, 180), [10, 0], 'Bearing 180° left turns east');

// 4. Bearing 270°: three-quarter turn
// Top (0, -10) was North -> now West [-10, 0]
assertPointClose(planToMap(0, -10, origin, 270), [-10, 0], 'Bearing 270° top turns west');
// Right (10, 0) was East -> now North [0, 10]
assertPointClose(planToMap(10, 0, origin, 270), [0, 10], 'Bearing 270° right turns north');
// Bottom (0, 10) was South -> now East [10, 0]
assertPointClose(planToMap(0, 10, origin, 270), [10, 0], 'Bearing 270° bottom turns east');
// Left (-10, 0) was West -> now South [0, -10]
assertPointClose(planToMap(-10, 0, origin, 270), [0, -10], 'Bearing 270° left turns south');

// 5. Non-centred centre: test with centre at (100, 200)
const offsetCentre = { x: 100, y: 200 };
assertPointClose(planToMap(100, 200, offsetCentre, 0), [0, 0], 'Non-centred centre maps to [0, 0] at 0°');
assertPointClose(planToMap(100, 200, offsetCentre, 45), [0, 0], 'Non-centred centre maps to [0, 0] at 45°');
assertPointClose(planToMap(100, 200, offsetCentre, 180), [0, 0], 'Non-centred centre maps to [0, 0] at 180°');

// Top relative to (100, 200): (100, 190) -> dy = -10 (up = 10)
assertPointClose(planToMap(100, 190, offsetCentre, 0), [0, 10], 'Offset centre top at 0° is [0, 10]');
assertPointClose(planToMap(100, 190, offsetCentre, 90), [10, 0], 'Offset centre top at 90° is [10, 0]');
assertPointClose(planToMap(100, 190, offsetCentre, 180), [0, -10], 'Offset centre top at 180° is [0, -10]');
assertPointClose(planToMap(100, 190, offsetCentre, 270), [-10, 0], 'Offset centre top at 270° is [-10, 0]');

// Right relative to (100, 200): (110, 200) -> dx = 10 (right = 10)
assertPointClose(planToMap(110, 200, offsetCentre, 0), [10, 0], 'Offset centre right at 0° is [10, 0]');
assertPointClose(planToMap(110, 200, offsetCentre, 90), [0, -10], 'Offset centre right at 90° is [0, -10]');
assertPointClose(planToMap(110, 200, offsetCentre, 180), [-10, 0], 'Offset centre right at 180° is [-10, 0]');
assertPointClose(planToMap(110, 200, offsetCentre, 270), [0, 10], 'Offset centre right at 270° is [0, 10]');

// 6. Invariant distance: distance from centre before and after rotation must be equal
const testCentres = [{ x: 0, y: 0 }, { x: 100, y: 200 }, { x: -45.5, y: 88.2 }];
const testPoints = [
  { x: 3, y: 4 },
  { x: -5, y: 12 },
  { x: 15, y: -20 },
  { x: 80, y: 60 },
  { x: -33.3, y: -44.4 },
];
const testBearings = [0, 15, 30, 45, 60, 90, 123.45, 180, 215, 270, 315, 359, 360, 450, -45];

for (const c of testCentres) {
  for (const pt of testPoints) {
    const planDist = Math.hypot(pt.x - c.x, pt.y - c.y);
    for (const bearing of testBearings) {
      const mapPt = planToMap(pt.x, pt.y, c, bearing);
      const mapDist = Math.hypot(mapPt[0], mapPt[1]);
      assertClose(mapDist, planDist, `Distance invariant at bearing ${bearing} deg from centre (${c.x}, ${c.y})`, 1e-8);
    }
  }
}
console.log('✓ Suite A passed (planToMap rotations, non-centred origin, and distance invariant).');

// ---------------------------------------------------------------------------
// Suite B: Compass heading calculation (`gazeBearing`)
// ---------------------------------------------------------------------------
console.log('Testing Suite B: Compass heading calculation (gazeBearing)...');

// 1. Controller yaw 0 (looking towards -z / plan top) with bearing 0 -> 0° (North)
assertClose(gazeBearing(0, 0), 0, 'Yaw 0 with bearing 0 -> 0° (North)');

// 2. Controller yaw -PI/2 (looking east) with bearing 0 -> 90° (East)
assertClose(gazeBearing(-Math.PI / 2, 0), 90, 'Yaw -PI/2 with bearing 0 -> 90° (East)');

// 3. Controller yaw PI or -PI (looking south) with bearing 0 -> 180° (South)
assertClose(gazeBearing(Math.PI, 0), 180, 'Yaw PI with bearing 0 -> 180° (South)');
assertClose(gazeBearing(-Math.PI, 0), 180, 'Yaw -PI with bearing 0 -> 180° (South)');

// 4. Controller yaw PI/2 (looking west) with bearing 0 -> 270° (West)
assertClose(gazeBearing(Math.PI / 2, 0), 270, 'Yaw PI/2 with bearing 0 -> 270° (West)');

// 5. Combined yaw and bearing
assertClose(gazeBearing(-Math.PI / 2, 45), 135, 'Bearing 45° with yaw -PI/2 -> 135° (SE)');
assertClose(gazeBearing(-Math.PI / 2, 90), 180, 'Bearing 90° with yaw -PI/2 -> 180° (South)');
assertClose(gazeBearing(Math.PI / 2, 180), 90, 'Bearing 180° with yaw PI/2 -> 90° (East)');
assertClose(gazeBearing(-Math.PI / 2, 270), 0, 'Bearing 270° with yaw -PI/2 -> 0° (North)');
assertClose(gazeBearing(0, 30), 30, 'Bearing 30° with yaw 0 -> 30°');
assertClose(gazeBearing(Math.PI, 60), 240, 'Bearing 60° with yaw PI -> 240° (SW)');

// 6. Wrap-around handling: negative angles wrap to [0, 360), angles > 360 wrap cleanly
assertClose(gazeBearing(0, -90), 270, 'Negative bearing -90° wraps to 270°');
assertClose(gazeBearing(0, -450), 270, 'Negative bearing -450° wraps to 270°');
assertClose(gazeBearing(0, -720), 0, 'Negative bearing -720° wraps to 0°');
assertClose(gazeBearing(0, 400), 40, 'Bearing 400° wraps to 40°');
assertClose(gazeBearing(0, 720), 0, 'Bearing 720° wraps to 0°');
assertClose(gazeBearing(2 * Math.PI, 0), 0, 'Yaw 2*PI wraps to 0°');
assertClose(gazeBearing(3 * Math.PI, 0), 180, 'Yaw 3*PI wraps to 180°');
assertClose(gazeBearing(-3 * Math.PI, 0), 180, 'Yaw -3*PI wraps to 180°');
assertClose(gazeBearing(-4 * Math.PI, 0), 0, 'Yaw -4*PI wraps to 0°');
assertClose(gazeBearing(-Math.PI / 2, 540), 270, 'Bearing 540° with yaw -PI/2 wraps to 270°');
assertClose(gazeBearing(Math.PI / 4, 0), 315, 'Yaw PI/4 (turn left 45°) with bearing 0 wraps to 315° (NW)');
assertClose(gazeBearing(Math.PI / 6, -30), 300, 'Negative bearing -30° with yaw PI/6 wraps to 300°');

// Sweep test: all headings must be finite and within [0, 360)
for (let b = -720; b <= 720; b += 15) {
  for (let y = -4 * Math.PI; y <= 4 * Math.PI; y += Math.PI / 6) {
    const heading = gazeBearing(y, b);
    assert.ok(Number.isFinite(heading), `Heading must be finite for yaw=${y}, bearing=${b}`);
    assert.ok(heading >= 0 && heading < 360, `Heading ${heading} must be in [0, 360) for yaw=${y}, bearing=${b}`);
  }
}
console.log('✓ Suite B passed (gazeBearing cardinal headings, yaw combinations, and wrap-around).');

// ---------------------------------------------------------------------------
// Suite C: Per-plan storage functions (`loadPlanMapState`, `savePlanMapState`, `getPlanStorageKey`)
// ---------------------------------------------------------------------------
console.log('Testing Suite C: Per-plan storage functions...');

// Set up mock localStorage in node environment
const memoryStore = new Map<string, string>();
const mockLocalStorage = {
  getItem(key: string): string | null {
    return memoryStore.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    memoryStore.set(key, String(value));
  },
  removeItem(key: string): void {
    memoryStore.delete(key);
  },
  clear(): void {
    memoryStore.clear();
  },
  key(index: number): string | null {
    return Array.from(memoryStore.keys())[index] ?? null;
  },
  get length(): number {
    return memoryStore.size;
  },
};
(globalThis as unknown as { localStorage: typeof mockLocalStorage }).localStorage = mockLocalStorage;

const planA: FloorPlanData = {
  name: 'Engineering Hall',
  description: 'Main lecture building',
  unit: 'meters',
  bounds: { minX: 0, minY: 0, maxX: 40, maxY: 30 },
  defaultWallHeight: 2.8,
  defaultExteriorThickness: 0.25,
  defaultInteriorThickness: 0.15,
  spawnPoint: { x: 20, y: 15 },
  walls: [
    { id: 'w1', x1: 0, y1: 0, x2: 40, y2: 0 },
    { id: 'w2', x1: 40, y1: 0, x2: 40, y2: 30 },
    { id: 'w3', x1: 40, y1: 30, x2: 0, y2: 30 },
    { id: 'w4', x1: 0, y1: 30, x2: 0, y2: 0 },
  ],
  doors: [],
  windows: [],
  rooms: [],
};

const planB: FloorPlanData = {
  name: 'Science Complex',
  description: 'Research laboratories',
  unit: 'meters',
  bounds: { minX: 10, minY: 15, maxX: 80, maxY: 90 },
  defaultWallHeight: 3.2,
  defaultExteriorThickness: 0.3,
  defaultInteriorThickness: 0.15,
  spawnPoint: { x: 45, y: 50 },
  walls: [
    { id: 'w1', x1: 10, y1: 15, x2: 80, y2: 15 },
    { id: 'w2', x1: 80, y1: 15, x2: 80, y2: 90 },
    { id: 'w3', x1: 80, y1: 90, x2: 10, y2: 90 },
    { id: 'w4', x1: 10, y1: 90, x2: 10, y2: 15 },
    { id: 'w5', x1: 45, y1: 15, x2: 45, y2: 90 },
    { id: 'w6', x1: 10, y1: 50, x2: 80, y2: 50 },
  ],
  doors: [],
  windows: [],
  rooms: [],
};

// 1. Storage key generation
const keyA = getPlanStorageKey(planA);
const keyB = getPlanStorageKey(planB);
assert.ok(keyA.startsWith('b3d.planmap.'), `Storage key must use prefix 'b3d.planmap.': got ${keyA}`);
assert.notEqual(keyA, keyB, 'Keys for distinct plans must differ');

// Key isolation across variations:
// Different bounds produce different keys:
const planSameNameDifferentBounds: FloorPlanData = {
  ...planA,
  bounds: { minX: 0, minY: 0, maxX: 50, maxY: 30 },
};
assert.notEqual(
  getPlanStorageKey(planA),
  getPlanStorageKey(planSameNameDifferentBounds),
  'Plans with different bounds must have different keys'
);

// Different wall count produces different keys:
const planSameNameDifferentWalls: FloorPlanData = {
  ...planA,
  walls: [...planA.walls, { id: 'w5', x1: 0, y1: 15, x2: 40, y2: 15 }],
};
assert.notEqual(
  getPlanStorageKey(planA),
  getPlanStorageKey(planSameNameDifferentWalls),
  'Plans with different wall counts must have different keys'
);

// 2. Round-trip serialization & persistence
const stateA: PlanMapState = { bearing: 45, query: 'Guindy, Chennai' };
savePlanMapState(keyA, stateA);
const loadedA = loadPlanMapState(keyA);
assert.ok(loadedA !== null, 'Loaded state must not be null');
assert.deepEqual(loadedA, stateA, 'Loaded state must match saved state');

// 3. Plan isolation
const stateB: PlanMapState = { bearing: 180, query: 'IIT Madras, Adyar' };
savePlanMapState(keyB, stateB);

// Ensure states remain isolated and do not overwrite each other
assert.deepEqual(loadPlanMapState(keyA), stateA, 'Plan A state must not be affected by saving Plan B');
assert.deepEqual(loadPlanMapState(keyB), stateB, 'Plan B state must match saved state');

// Update Plan A and confirm Plan B is still isolated
const updatedA: PlanMapState = { bearing: 120, query: 'Marina Beach, Chennai' };
savePlanMapState(keyA, updatedA);
assert.deepEqual(loadPlanMapState(keyA), updatedA, 'Plan A state updated successfully');
assert.deepEqual(loadPlanMapState(keyB), stateB, 'Plan B state remained isolated after Plan A update');

// 4. Corrupt data recovery
mockLocalStorage.setItem('corrupt.invalid_json', '{ bad json, missing quotes: ');
assert.equal(loadPlanMapState('corrupt.invalid_json'), null, 'Invalid JSON must return null without throwing');

mockLocalStorage.setItem('corrupt.number', '12345');
assert.equal(loadPlanMapState('corrupt.number'), null, 'Number JSON must return null');

mockLocalStorage.setItem('corrupt.string', '"raw string"');
assert.equal(loadPlanMapState('corrupt.string'), null, 'String JSON must return null');

mockLocalStorage.setItem('corrupt.array', '[1, 2, 3]');
assert.equal(loadPlanMapState('corrupt.array'), null, 'Array JSON must return null');

mockLocalStorage.setItem('corrupt.null', 'null');
assert.equal(loadPlanMapState('corrupt.null'), null, 'Null JSON must return null');

mockLocalStorage.setItem('corrupt.missing_bearing', JSON.stringify({ query: 'Missing bearing' }));
assert.equal(loadPlanMapState('corrupt.missing_bearing'), null, 'Object missing bearing must return null');

// A bearing set before any place is chosen must survive a reload.
mockLocalStorage.setItem('bearing.only', JSON.stringify({ bearing: 90 }));
assert.deepEqual(loadPlanMapState('bearing.only'), { bearing: 90 }, 'Bearing without a place must be kept');

mockLocalStorage.setItem('corrupt.non_numeric_bearing', JSON.stringify({ bearing: '90', query: 'Bad bearing' }));
assert.equal(loadPlanMapState('corrupt.non_numeric_bearing'), null, 'Non-numeric bearing must return null');

mockLocalStorage.setItem('corrupt.nan_bearing', JSON.stringify({ bearing: null, query: 'NaN bearing' }));
assert.equal(loadPlanMapState('corrupt.nan_bearing'), null, 'Null bearing must return null');

// Non-existent key
assert.equal(loadPlanMapState('non.existent.plan.key'), null, 'Non-existent key must return null');

// 5. Throwing storage handling (e.g. SecurityError or QuotaExceededError)
const origGetItem = mockLocalStorage.getItem;
mockLocalStorage.getItem = () => {
  throw new Error('SecurityError: Access to localStorage is denied (private browsing / disabled)');
};
assert.doesNotThrow(() => {
  const result = loadPlanMapState(keyA);
  assert.equal(result, null, 'loadPlanMapState must return null when getItem throws');
}, 'loadPlanMapState must catch throwing storage safely');
mockLocalStorage.getItem = origGetItem;

const origSetItem = mockLocalStorage.setItem;
mockLocalStorage.setItem = () => {
  throw new Error('QuotaExceededError: LocalStorage quota exceeded');
};
assert.doesNotThrow(() => {
  savePlanMapState(keyA, { bearing: 90, query: 'Overflow' });
}, 'savePlanMapState must catch throwing storage safely');
mockLocalStorage.setItem = origSetItem;

// Verify normal functionality after throwing test
savePlanMapState(keyA, stateA);
assert.deepEqual(loadPlanMapState(keyA), stateA, 'Storage continues functioning normally after error handling');

console.log('✓ Suite C passed (per-plan storage round-trip, plan isolation, corruption recovery, and error resilience).');

// ---------------------------------------------------------------------------
// Suite D: lookup errors keep the server's reason (`lookupSite`)
// ---------------------------------------------------------------------------
console.log('Testing Suite D: lookupSite error messages...');

const realFetch = globalThis.fetch;
const stubFetch = (impl: () => Promise<unknown>) => { globalThis.fetch = impl as unknown as typeof fetch; };
const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

await (async () => {
  try {
    stubFetch(() => jsonResponse(404, { success: false, error: 'No place matched that search.' }));
    await assert.rejects(lookupSite('nowhere at all'), /No place matched that search\..*bundled regions/,
      'A server rejection must keep its own message and point to bundled regions');

    stubFetch(() => jsonResponse(500, null));
    await assert.rejects(lookupSite('another unknown place'), /HTTP 500.*bundled regions/,
      'A server error without a message must report the HTTP status');

    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    await assert.rejects(lookupSite('offline place'), /could not be reached.*bundled regions/,
      'A network failure must say the service could not be reached');
  } finally {
    globalThis.fetch = realFetch;
  }
})();

console.log('✓ Suite D passed (server reasons kept, network failure worded separately).');

// ---------------------------------------------------------------------------
console.log('All geo regression tests passed successfully!');
