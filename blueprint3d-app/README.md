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

Fourteen backend regression methods cover clean black/gray inputs, smaller images,
outline/reference imports, invalid/blank content, nested transformed DXF blocks,
explicit review state, geometry holes, opening heights and door evidence.
Three.js checks cover concave/holed meshes, bounds, dimensions, spawn/door clearance
and manual tracing. Optional JSON-response paths passed to the last command check
saved real detections too.

DXF implementation follows the [ezdxf decomposition documentation](https://ezdxf.readthedocs.io/en/stable/disassemble.html).
