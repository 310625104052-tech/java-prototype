/** Site map data: types, lookup with a browser cache, and the plan-to-map transform. */

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

const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
const CACHE_PREFIX = 'b3d.sitemap.';

const cacheKey = (query: string) => CACHE_PREFIX + query.trim().toLowerCase().replace(/\s+/g, ' ');

function readCache(query: string): SiteMapData | null {
  try {
    const raw = localStorage.getItem(cacheKey(query));
    return raw ? (JSON.parse(raw) as SiteMapData) : null;
  } catch {
    return null; // storage blocked or corrupt entry
  }
}

function writeCache(query: string, map: SiteMapData) {
  try {
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
  const response = await fetch(`/geo/${file}`);
  if (!response.ok) throw new Error('The bundled map could not be loaded.');
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
