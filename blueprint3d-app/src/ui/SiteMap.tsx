import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPin, Search, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { FloorPlanData } from '../types/floorplan';
import { StudioMark } from './StudioMark';
import {
  BundledRegion,
  GeoFeature,
  SiteMapData,
  gazeBearing,
  getPlanStorageKey,
  loadBundledRegion,
  loadBundledRegions,
  loadPlanMapState,
  lookupSite,
  planToMap,
  readCache,
  savePlanMapState,
} from '../utils/geoMap';

interface SiteMapProps {
  isOpen: boolean;
  floorPlan: FloorPlanData;
  playerPos: { x: number; z: number; yaw: number };
  onClose: () => void;
}

const ROAD_WIDTH: Record<string, number> = {
  motorway: 9, trunk: 9, primary: 8, secondary: 7, tertiary: 6, residential: 4.5,
  unclassified: 4.5, service: 3, footway: 1.4, path: 1.4, steps: 1.4, cycleway: 1.6, pedestrian: 3,
};
const FILL: Record<string, string> = { building: '#d9cfbd', water: '#bcd7e8', green: '#cfe0bf', place: '#e6d9c3' };
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const points = (p: [number, number][]) => p.map(([x, y]) => `${x},${-y}`).join(' ');
const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

export function SiteMap({ isOpen, floorPlan, playerPos, onClose }: SiteMapProps) {
  const [query, setQuery] = useState('');
  const [site, setSite] = useState<SiteMapData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bearing, setBearing] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [regions, setRegions] = useState<BundledRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [placeQuery, setPlaceQuery] = useState<string | undefined>(undefined);
  const [regionFile, setRegionFile] = useState<string | undefined>(undefined);

  const planKey = useMemo(() => getPlanStorageKey(floorPlan), [floorPlan]);

  // Open zoomed so the building is clearly visible: about a fifth of the view across.
  const span = Math.max(floorPlan.bounds.maxX - floorPlan.bounds.minX, floorPlan.bounds.maxY - floorPlan.bounds.minY, 5);
  const fitZoom = Math.min(6, Math.max(1, 300 / (span * 5)));

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Load bundled regions manifest
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    loadBundledRegions()
      .then((list) => {
        if (!active) return;
        setRegions(list);
        if (list.length > 0) {
          setSelectedRegionId((prev) => (list.some((r) => r.id === prev) ? prev : list[0].id));
        }
      })
      .catch(() => {
        if (!active) return;
        const fallback: BundledRegion[] = [
          {
            id: 'srm-easwari',
            name: 'SRM Easwari Engineering College, Ramapuram, Chennai',
            file: 'sample-chennai.json',
          },
        ];
        setRegions(fallback);
        setSelectedRegionId((prev) => (fallback.some((r) => r.id === prev) ? prev : fallback[0].id));
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  // Restore saved plan map state from localStorage
  useEffect(() => {
    if (!isOpen) return;

    const saved = loadPlanMapState(planKey);
    if (!saved) {
      setBearing(0);
      setSite(null);
      setQuery('');
      setError(null);
      setPlaceQuery(undefined);
      setRegionFile(undefined);
      return;
    }

    if (typeof saved.bearing === 'number') {
      setBearing(saved.bearing);
    }

    const savedQuery = saved.placeQuery || saved.query;
    if (saved.regionFile) {
      setRegionFile(saved.regionFile);
      setPlaceQuery(undefined);
      setQuery('');
      void run(async () => loadBundledRegion(saved.regionFile!));
    } else if (savedQuery) {
      setPlaceQuery(savedQuery);
      setRegionFile(undefined);
      setQuery(savedQuery);

      const cached = readCache(savedQuery);
      if (cached) {
        setSite(cached);
        setZoom(fitZoom);
        setError(null);
      } else {
        setSite(null);
      }
    } else {
      setPlaceQuery(undefined);
      setRegionFile(undefined);
      setSite(null);
    }
  }, [isOpen, planKey, fitZoom]);

  const run = async (task: () => Promise<SiteMapData>) => {
    setBusy(true);
    setError(null);
    try {
      const data = await task();
      setSite(data);
      setZoom(fitZoom);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The map could not be loaded.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleBearingChange = (val: number) => {
    setBearing(val);
    savePlanMapState(planKey, {
      bearing: val,
      placeQuery,
      regionFile,
    });
  };

  const handleSelectRegion = async (region: BundledRegion) => {
    setSelectedRegionId(region.id);
    const data = await run(() => loadBundledRegion(region.file));
    if (data) {
      setPlaceQuery(undefined);
      setRegionFile(region.file);
      savePlanMapState(planKey, {
        bearing,
        regionFile: region.file,
      });
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length >= 3) {
      void run(async () => {
        const data = await lookupSite(q);
        setPlaceQuery(q);
        setRegionFile(undefined);
        savePlanMapState(planKey, {
          bearing,
          placeQuery: q,
        });
        return data;
      });
    }
  };

  const centre = useMemo(() => ({
    x: (floorPlan.bounds.minX + floorPlan.bounds.maxX) / 2,
    y: (floorPlan.bounds.minY + floorPlan.bounds.maxY) / 2,
  }), [floorPlan.bounds]);

  const footprints = useMemo(() => {
    const rings = floorPlan.shell?.footprint.map((p) => p.outer) ?? [[
      [floorPlan.bounds.minX, floorPlan.bounds.minY], [floorPlan.bounds.maxX, floorPlan.bounds.minY],
      [floorPlan.bounds.maxX, floorPlan.bounds.maxY], [floorPlan.bounds.minX, floorPlan.bounds.maxY],
    ]];
    return rings.map((ring) => ring.map(([x, y]) => planToMap(x, y, centre, bearing)));
  }, [floorPlan, centre, bearing]);

  if (!isOpen) return null;

  const view = (site?.radius ?? 300) / zoom;
  const size = view * 2;
  const player = planToMap(playerPos.x, playerPos.z, centre, bearing);
  const gazeTip = planToMap(playerPos.x - Math.sin(playerPos.yaw) * 1, playerPos.z - Math.cos(playerPos.yaw) * 1, centre, bearing);
  const gx = gazeTip[0] - player[0], gy = gazeTip[1] - player[1];
  const unit = size / 150; // drawing unit for markers and text, in metres
  const polygons = (kind: string) => (site?.features ?? []).filter((f) => f.k === kind);
  const roads = polygons('road') as GeoFeature[];
  const heading = Math.round(gazeBearing(playerPos.yaw, bearing));
  const activeRegion = regions.find((r) => r.id === selectedRegionId) ?? regions[0];

  return (
    <div className="studio-modal-backdrop" onClick={onClose} data-ui>
      <div className="studio-modal-sheet studio-map-sheet" role="dialog" aria-label="Site map" onClick={(e) => e.stopPropagation()}>
        <header className="studio-modal-header">
          <div className="studio-modal-title-group">
            <StudioMark compact />
            <span className="studio-toolbar-divider" aria-hidden="true" />
            <div>
              <div className="studio-modal-kicker">SITE CONTEXT</div>
              <h2>{site ? site.center.name.split(',').slice(0, 2).join(',') : 'Where is this building?'}</h2>
            </div>
          </div>
          <div className="studio-modal-header-actions">
            <button type="button" className="studio-icon-button" onClick={onClose} title="Close (Esc)">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="studio-site-body">
          <aside className="studio-site-side">
            <form onSubmit={submit} className="studio-site-search">
              <label htmlFor="site-query">Place or coordinates</label>
              <div>
                <input id="site-query" value={query} maxLength={200} placeholder="e.g. Ramapuram, Chennai or 13.0338, 80.1801"
                  onChange={(e) => setQuery(e.target.value)} />
                <button type="submit" className="studio-primary" disabled={busy || query.trim().length < 3}>
                  {busy ? <Loader2 className="studio-spin" size={15} aria-hidden="true" /> : <Search size={15} aria-hidden="true" />} Find
                </button>
              </div>
            </form>

            {error && (
              <div className="studio-site-error" role="alert">
                {error}
              </div>
            )}

            <div className="studio-site-bundled">
              <label htmlFor="bundled-region-select">Bundled offline regions</label>
              <div className="studio-site-bundled-controls">
                <select
                  id="bundled-region-select"
                  className="studio-site-select"
                  value={selectedRegionId}
                  disabled={busy || regions.length === 0}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedRegionId(id);
                    const region = regions.find((r) => r.id === id);
                    if (region) void handleSelectRegion(region);
                  }}
                  aria-label="Bundled offline regions"
                >
                  {regions.length === 0 ? (
                    <option value="">Loading offline regions…</option>
                  ) : (
                    regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  className="studio-secondary studio-site-bundled-btn"
                  disabled={busy || !activeRegion}
                  onClick={() => {
                    if (activeRegion) void handleSelectRegion(activeRegion);
                  }}
                >
                  <MapPin size={15} aria-hidden="true" /> Use bundled region (works offline)
                </button>
              </div>
            </div>

            <label className="studio-site-slider">
              Plan top points to {bearing}° ({compass(bearing)})
              <input type="range" min={0} max={359} value={bearing} onChange={(e) => handleBearingChange(Number(e.target.value))} />
            </label>
            <p className="studio-site-note">
              A floor plan does not say which way is north. Turn the slider until the building sits as it does on the ground.
              The blue dot follows you while you walk.
            </p>

            {site && (
              <>
                <h3>Nearby named places</h3>
                <ul className="studio-site-places">
                  {site.places.length === 0 && <li>No named places within {site.radius} m.</li>}
                  {site.places.map((p) => <li key={p.n}><span>{p.n}</span><em>{p.d} m</em></li>)}
                </ul>
                <p className="studio-site-credit">
                  {site.source}, saved {site.fetchedAt}. Maps you have opened are kept in this browser and open without internet.
                </p>
              </>
            )}
          </aside>

          <div className="studio-site-canvas">
            {!site ? (
              <div className="studio-site-empty">
                <MapPin size={28} aria-hidden="true" />
                <p>Enter where the building stands, or open a bundled region, to see the roads and buildings around it.</p>
              </div>
            ) : (
              <>
                <svg viewBox={`${-view} ${-view} ${size} ${size}`} role="img" aria-label="Map of the surroundings with the building outline and your position">
                  <rect x={-view} y={-view} width={size} height={size} fill="#f3efe6" />
                  {polygons('place').map((f, i) => <polygon key={`p${i}`} points={points(f.p)} fill={FILL.place} stroke="#c9b998" strokeWidth={0.6} />)}
                  {polygons('green').map((f, i) => <polygon key={`g${i}`} points={points(f.p)} fill={FILL.green} />)}
                  {polygons('water').map((f, i) => (f.p.length > 3
                    ? <polygon key={`w${i}`} points={points(f.p)} fill={FILL.water} />
                    : <polyline key={`w${i}`} points={points(f.p)} fill="none" stroke={FILL.water} strokeWidth={3} />))}
                  {roads.map((f, i) => <polyline key={`c${i}`} points={points(f.p)} fill="none" stroke="#cfc8b8" strokeWidth={(ROAD_WIDTH[f.c] ?? 3) + 1.6} strokeLinecap="round" strokeLinejoin="round" />)}
                  {roads.map((f, i) => <polyline key={`r${i}`} points={points(f.p)} fill="none" stroke="#fffdf9" strokeWidth={ROAD_WIDTH[f.c] ?? 3} strokeLinecap="round" strokeLinejoin="round" />)}
                  {polygons('building').map((f, i) => <polygon key={`b${i}`} points={points(f.p)} fill={FILL.building} stroke="#b7ab95" strokeWidth={0.5} />)}
                  {site.places.filter((p) => p.d < view * 0.95).map((p) => (
                    <text key={p.n} x={p.x} y={-p.y} fontSize={unit * 2.6} textAnchor="middle" fill="#3b4a55" stroke="#f3efe6" strokeWidth={unit * 0.6} paintOrder="stroke">{p.n}</text>
                  ))}
                  {footprints.map((ring, i) => <polygon key={`f${i}`} points={points(ring as [number, number][])} fill="#1947e533" stroke="#1947e5" strokeWidth={unit * 0.5} />)}
                  <polygon points={`${player[0]},${-player[1]} ${player[0] + gx * unit * 7 - gy * unit * 2.4},${-(player[1] + gy * unit * 7 + gx * unit * 2.4)} ${player[0] + gx * unit * 7 + gy * unit * 2.4},${-(player[1] + gy * unit * 7 - gx * unit * 2.4)}`} fill="#1947e5aa" />
                  <circle cx={player[0]} cy={-player[1]} r={unit * 1.1} fill="#1947e5" stroke="#fff" strokeWidth={unit * 0.35} />
                  <g transform={`translate(${view - unit * 8},${-view + unit * 12})`}>
                    <polygon points={`0,${-unit * 6} ${unit * 2.4},${unit * 2} 0,0 ${-unit * 2.4},${unit * 2}`} fill="#142330" />
                    <text y={-unit * 7.5} fontSize={unit * 3.4} textAnchor="middle" fill="#142330" fontWeight={600}>N</text>
                  </g>
                  <g transform={`translate(${-view + unit * 6},${view - unit * 6})`}>
                    <rect width={50} height={unit * 0.9} fill="#142330" />
                    <text y={-unit * 1.2} fontSize={unit * 2.8} fill="#142330">50 m</text>
                  </g>
                </svg>
                <div className="studio-site-zoom">
                  <button type="button" className="studio-icon-button" onClick={() => setZoom((z) => Math.min(6, z * 1.4))} title="Zoom in"><ZoomIn size={16} aria-hidden="true" /></button>
                  <button type="button" className="studio-icon-button" onClick={() => setZoom((z) => Math.max(0.7, z / 1.4))} title="Zoom out"><ZoomOut size={16} aria-hidden="true" /></button>
                </div>
                <div className="studio-site-heading">Facing {compass(heading)} · {heading}°</div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
