/** Site map data: types, lookup with a browser cache, and the plan-to-map transform. */

import type { FloorPlanData } from '../types/floorplan';

export type GeoKind = 'road' | 'building' | 'water' | 'green' | 'place';
export interface GeoFeature { k: GeoKind; c: string; n?: string; p: [number, number][] }
export interface GeoPlace { n: string; k: GeoKind; x: number; y: number; d: number }
export interface SiteMapData {
  center: { lat: number; lon: number; name: string };
  radius: number;
  features: GeoFeature[];
  places: GeoPlace[];
  source: string;
  fetchedAt: string;
}

export interface BundledRegion {
  id: string;
  name: string;
  file: string;
}

export interface PlanMapState {
  bearing: number;
  placeQuery?: string;
  regionFile?: string;
}

const API_BASE = (import.meta.env?.VITE_API_URL ?? '').replace(/\/+$/, '');
const CACHE_PREFIX = 'b3d.sitemap.';
const PLAN_STATE_PREFIX = 'b3d.planmap.';

const cacheKey = (query: string) => CACHE_PREFIX + query.trim().toLowerCase().replace(/\s+/g, ' ');

export function readCache(query: string): SiteMapData | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(cacheKey(query));
    return raw ? (JSON.parse(raw) as SiteMapData) : null;
  } catch {
    return null; // storage blocked or corrupt entry
  }
}

export function writeCache(query: string, map: SiteMapData) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(cacheKey(query), JSON.stringify(map));
  } catch {
    /* storage full or blocked: the map still works, it just is not kept */
  }
}

/** Bundled regions catalogue for offline map picker. */
export async function loadBundledRegions(): Promise<BundledRegion[]> {
  const response = await fetch('/geo/regions.json');
  if (!response.ok) throw new Error('The bundled regions list could not be loaded.');
  return (await response.json()) as BundledRegion[];
}

/** Load a bundled map by filename from the offline catalogue. */
export async function loadBundledRegion(file: string): Promise<SiteMapData> {
  const clean = file.replace(/^\/+/, '').replace(/^geo\//, '');
  const response = await fetch(`/geo/${clean}`);
  if (!response.ok) throw new Error(`The bundled map ${file} could not be loaded.`);
  return (await response.json()) as SiteMapData;
}

/** Bundled map of the demo campus; needs no network and no backend. */
export async function loadSampleSite(): Promise<SiteMapData> {
  return loadBundledRegion('sample-chennai.json');
}

/** Map for a place name or "lat, lon". A map seen before opens from the browser cache. */
export async function lookupSite(query: string): Promise<SiteMapData> {
  const cached = readCache(query);
  if (cached) return cached;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/geo/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
  } catch {
    throw new Error('The live map service could not be reached. Saved maps and bundled regions below still work offline.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error('The live map service could not be reached. Saved maps and bundled regions below still work offline.');
  }
  writeCache(query, body.map as SiteMapData);
  return body.map as SiteMapData;
}

function quickWallHash(walls?: FloorPlanData['walls']): string {
  if (!walls || walls.length === 0) return '0';
  let hash = 0;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (!w) continue;
    const v =
      Math.round((w.x1 ?? 0) * 10) +
      Math.round((w.y1 ?? 0) * 10) * 31 +
      Math.round((w.x2 ?? 0) * 10) * 961 +
      Math.round((w.y2 ?? 0) * 10) * 29791;
    hash = (hash ^ v) | 0;
  }
  return (hash >>> 0).toString(16);
}

/**
 * Generates a deterministic storage key based on plan footprint and metadata
 * so distinct plans have isolated settings.
 */
export function getPlanStorageKey(floorPlan: FloorPlanData): string {
  if (!floorPlan) return `${PLAN_STATE_PREFIX}default`;
  const name = (floorPlan.name || 'unnamed').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  const b = floorPlan.bounds;
  const boundsPart = b
    ? `${b.minX.toFixed(2)}_${b.minY.toFixed(2)}_${b.maxX.toFixed(2)}_${b.maxY.toFixed(2)}`
    : 'nobounds';
  const wallCount = floorPlan.walls?.length ?? 0;
  const shellCount = floorPlan.shell?.footprint?.length ?? 0;
  const wallHash = quickWallHash(floorPlan.walls);
  return `${PLAN_STATE_PREFIX}${name}.${boundsPart}.w${wallCount}.s${shellCount}.${wallHash}`;
}

/**
 * Loads saved plan map state (bearing, placeQuery, regionFile) from localStorage.
 * Catches all errors and returns null on failure or corrupted data.
 */
export function loadPlanMapState(key: string): PlanMapState | null {
  try {
    if (typeof localStorage === 'undefined' || !key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (typeof data.bearing !== 'number' || !Number.isFinite(data.bearing)) return null;
    const state: PlanMapState = {
      bearing: ((data.bearing % 360) + 360) % 360,
    };
    if (typeof data.placeQuery === 'string' && data.placeQuery.trim()) {
      state.placeQuery = data.placeQuery.trim();
    }
    if (typeof data.regionFile === 'string' && data.regionFile.trim()) {
      state.regionFile = data.regionFile.trim();
    }
    return state;
  } catch {
    return null;
  }
}

/**
 * Writes plan map state (bearing, placeQuery, regionFile) to localStorage.
 * Catches all errors safely without crashing.
 */
export function savePlanMapState(key: string, state: PlanMapState): void {
  try {
    if (typeof localStorage === 'undefined' || !key) return;
    if (!state || typeof state.bearing !== 'number' || !Number.isFinite(state.bearing)) return;
    const toSave: PlanMapState = {
      bearing: ((state.bearing % 360) + 360) % 360,
    };
    if (typeof state.placeQuery === 'string' && state.placeQuery.trim()) {
      toSave.placeQuery = state.placeQuery.trim();
    }
    if (typeof state.regionFile === 'string' && state.regionFile.trim()) {
      toSave.regionFile = state.regionFile.trim();
    }
    localStorage.setItem(key, JSON.stringify(toSave));
  } catch {
    /* storage quota exceeded, private mode security error, or blocked */
  }
}

/**
 * Plan metres to map metres (east, north). The plan's top edge points along the
 * compass bearing `bearingDeg`; the footprint centre sits on the map centre.
 */
export function planToMap(px: number, py: number, centre: { x: number; y: number }, bearingDeg: number): [number, number] {
  const right = px - centre.x;
  const up = -(py - centre.y); // plan y grows downwards
  const t = (bearingDeg * Math.PI) / 180;
  return [right * Math.cos(t) + up * Math.sin(t), -right * Math.sin(t) + up * Math.cos(t)];
}

/** Compass bearing of the player's gaze, given the controller yaw and the plan's own bearing. */
export function gazeBearing(yaw: number, bearingDeg: number): number {
  // Controller yaw 0 looks along -z, i.e. the plan's top edge; positive yaw turns left.
  return (((bearingDeg - (yaw * 180) / Math.PI) % 360) + 360) % 360;
}
