# Blueprint3D current prototype

The active React/Three.js app lives here. The root Flask/Java prototype and its
Graphify report are historical. Start from this directory:

```text
py -m pip install -r backend/requirements.txt
npm ci
npm run dev
```

Open http://localhost:3000. Vite proxies `/api` to FastAPI on 127.0.0.1:8001.

## Imports

PNG, JPG/JPEG and ASCII DXF files up to 15 MB are accepted. File import is distinct
from automatic reconstruction quality:

- Clear filled-wall plans open directly in the 3D overview.
- Smaller, scanned, outlined or incompletely connected plans open a source/overlay
  review with warnings and an optional approximate 3D preview.
- Drawings without a reliable floor footprint open as editable references. This
  includes the supplied complex site sheet, faint section and DXF sample. They are
  not automatically reconstructed into accurate buildings.

The review canvas supports tracing an exterior footprint, interior wall segments
and 0.9 m door gaps. Enter the footprint width in meters to set scale, then build
traced 3D. Traces are local session data and are labeled separately from automatic
reconstructions. The tool does not infer floor layouts from side elevations.

`blueprint_import.py` manages acceptance/reference modes. `structural_evidence.py`
handles filled walls, resolution adaptation and uncertain connectivity;
`linework.py` adds paired-outline recovery. Disconnected rooms produce explicit
warnings instead of blanket rejection, without inventing connecting doors.
`dxf_import.py` reads embedded nested INSERT transforms and architectural layer
geometry using ezdxf. Unspecified DXF units are flagged. External XREF files are
not fetched. Ducts, leaders, tables and annotation layers are excluded.

## 3D geometry

Connected wall footprints (with room holes) are extruded at door/window height
slices, rather than assembling fragmented Hough lines. Collision uses the same
ground-level wall geometry. Floors/roof preserve footprint shape and openings
keep their detected proportions. Uploaded models do not receive invented college
furniture, stairs or room labels. Spawn points have interior clearance. Switching
models disposes old GPU geometry, materials and textures.

Drag to rotate and scroll to zoom in overview. Walking needs pointer-lock support,
which some embedded browser panels block; use a normal browser tab there.

## Verification and limits

All 16 supplied files were uploaded through the running API: 6 direct models,
7 approximate models with review, and 3 editable references. This confirms import
coverage, not architectural accuracy. Scans and furniture/hatching-heavy drawings
may have extra/missing walls or openings and require correction. Thumbnails cannot
recover detail absent in their source. Scale still assumes typical door widths
unless manually entered. OCR labels and automatic DXF-to-building reconstruction
are not implemented.

```text
py -m unittest discover -s backend -p "test_*.py" -v
npm run lint
npm run build
node node_modules/esbuild/bin/esbuild tests/geometry-regression.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/blueprint3d/geometry-regression.mjs
node node_modules/.cache/blueprint3d/geometry-regression.mjs
```

Twenty backend regression methods cover clean black/gray inputs, smaller images,
outline/reference imports, invalid/blank content, nested transformed DXF blocks,
explicit review state, geometry holes, opening heights and door evidence.
Three.js checks cover concave/holed meshes, bounds, dimensions, spawn/door clearance
and manual tracing. Optional JSON-response paths passed to the last command check
saved real detections too.

The variety suite checks 46 synthetic variants, including mixed exterior/partition
widths, gray walls without black ink, 450–1500 px exports, quarter-turn rotations,
mirroring/inversion, colored floors, JPEG, noise, blur, skew and paired outlines.
Recognizable orthogonal fixtures must recover their known three rooms and two doors;
skewed and outlined drawings must request review. The original 16 supplied files
and the later furnished apartment sample are checked separately as real imports.
Thin partitions are recovered without widening source gaps. Passages narrower than
walking clearance at the estimated scale now request review, as do substantial
angled walls. This is a heuristic importer, not a guarantee of accurate reconstruction
for every blueprint style. Low-resolution sections remain editable references.

DXF implementation follows the [ezdxf decomposition documentation](https://ezdxf.readthedocs.io/en/stable/disassemble.html).

## Deployment

Pushing to `main` redeploys both halves automatically.

| Part | Host | URL | Notes |
|---|---|---|---|
| Frontend (Vite) | Vercel project `blueprint3d`, root `blueprint3d-app` | https://blueprint3d-eta.vercel.app | `VITE_API_URL` points at the backend |
| Backend (FastAPI) | Render web service `blueprint3d-api` (free plan) | https://blueprint3d-api.onrender.com | `ALLOWED_ORIGINS` lists the frontend URLs |

- The backend's free plan sleeps when idle, so the first upload after a quiet period can take 30-60 s.
- To allow a new frontend URL, add it to `ALLOWED_ORIGINS` (comma-separated) in the Render dashboard.
- The Vercel project's root directory is `blueprint3d-app`, so run any manual `vercel deploy` from the repository root, not from this folder.
- Do not add a `vercel.json` with `services`: it would also try to host the backend on Vercel, whose 4.5 MB request limit rejects larger plan uploads.

## Site map

The Site map button (overview toolbar and pause menu) shows the roads, buildings,
water, green areas and named places around the building, with the plan's outline and
your position while you walk.

- Data is OpenStreetMap (ODbL), fetched once per place: `POST /api/geo/lookup` takes a
  place name or `lat, lon`, geocodes it with Nominatim, reads the surroundings (300 m)
  from a public Overpass server, and returns a small vector map in metres. The server
  keeps each result on disk and the browser keeps it in `localStorage`, so a map you
  have opened works with no internet. Public Overpass servers are often busy; the
  backend tries several and reports a clear error if none answers.
- The sample campus (SRM Easwari College, Ramapuram) is bundled in
  `public/geo/sample-chennai.json` and needs no network or backend.
- A floor plan does not say which way is north, so the map has a rotation slider for
  the plan. The default of 0 puts the top of the plan at north.
- Limits: new lookups are capped at 8 per minute for the whole server, results are one
  radius of 300 m, and there are no satellite tiles or street-level labels beyond names
  that OpenStreetMap carries.
- Tests: `py -m unittest backend/test_geo.py` (no network needed).
