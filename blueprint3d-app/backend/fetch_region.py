"""Developer command-line tool to fetch and bundle region maps from OpenStreetMap.

Usage:
  py backend/fetch_region.py <query_or_lat_lon> [output_filename] [--name "Custom Display Name"]

Examples:
  py backend/fetch_region.py "SRM Easwari Engineering College, Ramapuram, Chennai"
  py backend/fetch_region.py "13.033779, 80.180058" chennai-campus.json --name "Chennai Campus"
"""
import argparse
import json
import re
import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from geo import (
    clean_query,
    parse_latlon,
    geocode,
    fetch_elements,
    build_map,
    validate_map,
    OVERPASS_SERVERS,
    MIN_GAP_S,
    GeoError,
)


def slugify(text: str) -> str:
    """Convert a name or query string into a URL/id-friendly slug."""
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    s = re.sub(r"-+", "-", s)
    return s or "region"


def update_regions_catalog(catalog_path: Path, region_id: str, name: str, filename: str) -> None:
    """Update or append a region entry in regions.json."""
    catalog = []
    if catalog_path.is_file():
        try:
            content = catalog_path.read_text(encoding="utf-8").strip()
            if content:
                loaded = json.loads(content)
                if isinstance(loaded, list):
                    catalog = loaded
        except (json.JSONDecodeError, OSError):
            catalog = []

    matched = False
    for entry in catalog:
        if isinstance(entry, dict) and (entry.get("id") == region_id or entry.get("file") == filename):
            entry["name"] = name
            entry["file"] = filename
            if not entry.get("id"):
                entry["id"] = region_id
            matched = True
            break

    if not matched:
        catalog.append({
            "id": region_id,
            "name": name,
            "file": filename,
        })

    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def fetch_and_bundle(
    query_or_coords: str,
    output_filename: str | None = None,
    custom_name: str | None = None,
    geo_dir: Path | None = None,
) -> dict:
    """Fetch region data from OSM, build and validate map, write to disk, and update catalog."""
    cleaned = clean_query(query_or_coords)

    point = parse_latlon(cleaned)
    if point is not None:
        lat, lon = point
        geo_label = f"{lat:.5f}, {lon:.5f}"
        print(f"Using coordinates: {lat:.6f}, {lon:.6f}")
    else:
        print(f"Geocoding '{cleaned}' with Nominatim...")
        lat, lon, geo_label = geocode(cleaned)
        print(f"Found: {geo_label} ({lat:.6f}, {lon:.6f})")

    label = custom_name.strip() if custom_name and custom_name.strip() else geo_label

    if output_filename:
        fname = Path(output_filename).name
        if not fname.lower().endswith(".json"):
            fname = f"{fname}.json"
        filename = fname
        slug = slugify(Path(filename).stem)
    else:
        base = custom_name.strip() if custom_name and custom_name.strip() else (cleaned if point is not None else geo_label)
        slug = slugify(base)
        filename = f"{slug}.json"

    print(f"Fetching elements via Overpass ({len(OVERPASS_SERVERS)} mirrors available, >= {MIN_GAP_S}s spacing)...")
    elements = fetch_elements(lat, lon)
    print(f"Fetched {len(elements)} elements from Overpass.")

    print(f"Building site map for '{label}'...")
    data = build_map(lat, lon, label, elements)

    print("Validating site map schema...")
    validate_map(data)

    target_dir = Path(geo_dir) if geo_dir else (Path(__file__).resolve().parent.parent / "public" / "geo")
    target_dir.mkdir(parents=True, exist_ok=True)

    out_file = target_dir / filename
    out_file.write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    print(f"Saved site map to {out_file}")

    catalog_path = target_dir / "regions.json"
    update_regions_catalog(catalog_path, slug, label, filename)
    print(f"Updated regions catalog at {catalog_path}")
    print(f"Successfully bundled region '{label}' (id: {slug}, file: {filename}).")

    return data


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Fetch and bundle a region site map from OpenStreetMap.",
        epilog=(
            "Examples:\n"
            '  py backend/fetch_region.py "SRM Easwari Engineering College, Ramapuram, Chennai"\n'
            '  py backend/fetch_region.py "13.033779, 80.180058" chennai-campus.json --name "Chennai Campus"\n'
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("query", help="Place name or 'lat, lon' coordinates")
    parser.add_argument("output_filename", nargs="?", default=None, help="Output JSON filename (optional)")
    parser.add_argument("--name", dest="custom_name", default=None, help="Custom display name for the region")
    parser.add_argument("--geo-dir", dest="geo_dir", default=None, help=argparse.SUPPRESS)

    args = parser.parse_args(argv)

    try:
        fetch_and_bundle(
            query_or_coords=args.query,
            output_filename=args.output_filename,
            custom_name=args.custom_name,
            geo_dir=args.geo_dir,
        )
        return 0
    except GeoError as exc:
        sys.stderr.write(f"Error: {exc.message}\n")
        return 1
    except Exception as exc:
        sys.stderr.write(f"Unexpected error: {exc}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
