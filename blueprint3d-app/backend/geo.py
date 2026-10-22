"""Site map data from OpenStreetMap.

A place name or coordinate pair is geocoded once (Nominatim), the roads, buildings,
water and green areas around it are fetched once (Overpass), and the result is
reduced to a small JSON map in metres around the centre. The browser draws that JSON
as vectors, so there is no tile server and a cached map works without any network.

Data (c) OpenStreetMap contributors, ODbL 1.0. Both public services ask for an
identifying User-Agent and at most about one request per second; this module sends
both calls rarely, caches every result, and throttles outbound traffic.
"""
import hashlib
import json
import math
import os
import re
import ssl
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path

NOMINATIM = "https://nominatim.openstreetmap.org/search"
OVERPASS_SERVERS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
USER_AGENT = "Blueprint3D-student-project/1.0 (https://github.com/Oxyrine/java-prototype)"
RADIUS_M = 300
HTTP_TIMEOUT_S = 25
MAX_RESPONSE_BYTES = 8_000_000
MAX_FEATURES = 2500
MIN_GAP_S = 1.1                 # spacing between outbound requests
MAX_FRESH_LOOKUPS_PER_MIN = 8   # uncached lookups allowed per minute, all clients together
CACHE_DIR = Path(os.environ.get("GEO_CACHE_DIR") or Path(__file__).resolve().parent / "geo_cache")

_LATLON = re.compile(r"^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$")
try:  # certifi's CA bundle works the same on every platform
    import certifi
    _SSL = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL = ssl.create_default_context()
_lock = threading.Lock()
_last_call = 0.0
_fresh = []


class GeoError(Exception):
    """An error with an HTTP status the API can return as is."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def clean_query(raw):
    text = " ".join(str(raw or "").split())
    if len(text) < 3 or len(text) > 200 or any(ord(c) < 32 for c in text):
        raise GeoError(400, "Enter a place name or a latitude and longitude (3 to 200 characters).")
    return text


def parse_latlon(text):
    m = _LATLON.match(text)
    if not m:
        return None
    lat, lon = float(m.group(1)), float(m.group(2))
    if not (-85 <= lat <= 85 and -180 <= lon <= 180):
        raise GeoError(400, "Latitude must be within 85 degrees and longitude within 180 degrees.")
    return lat, lon


def to_local(lat, lon, lat0, lon0):
    """Metres east and north of the centre (equirectangular, fine at 300 m)."""
    return ((lon - lon0) * 111320.0 * math.cos(math.radians(lat0)), (lat - lat0) * 110540.0)


def _throttle():
    global _last_call
    with _lock:
        now = time.monotonic()
        wait = _last_call + MIN_GAP_S - now
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()


def _http(url, body=None):
    _throttle()
    request = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_S, context=_SSL) as response:
            data = response.read(MAX_RESPONSE_BYTES + 1)
    except Exception as exc:  # network, timeout, HTTP error
        raise GeoError(502, "The map data service could not be reached. Try again in a moment.") from exc
    if len(data) > MAX_RESPONSE_BYTES:
        raise GeoError(502, "The map data service returned too much data for this area.")
    try:
        return json.loads(data)
    except ValueError as exc:
        raise GeoError(502, "The map data service returned an unreadable answer.") from exc


def geocode(text):
    url = NOMINATIM + "?" + urllib.parse.urlencode({"q": text, "format": "json", "limit": 1})
    hits = _http(url)
    if not hits:
        raise GeoError(404, "That place was not found. Try a more specific name or enter coordinates.")
    return float(hits[0]["lat"]), float(hits[0]["lon"]), str(hits[0].get("display_name", text))[:160]


def fetch_elements(lat, lon):
    around = f"(around:{RADIUS_M},{lat:.6f},{lon:.6f})"
    query = (
        "[out:json][timeout:20];("
        f'way["highway"]{around};way["building"]{around};way["natural"="water"]{around};'
        f'way["waterway"]{around};way["leisure"~"park|garden|pitch|playground"]{around};'
        f'way["landuse"~"grass|recreation_ground|forest|meadow"]{around};'
        f'way["amenity"]["name"]{around};'
        ");out tags geom;"
    )
    body = urllib.parse.urlencode({"data": query}).encode()
    error = None
    for server in OVERPASS_SERVERS:  # public servers are often busy; try the next one
        try:
            return _http(server, body).get("elements", [])
        except GeoError as exc:
            error = exc
    raise error


def _kind(tags):
    if "highway" in tags:
        return "road", tags["highway"]
    if "building" in tags:
        return "building", tags["building"]
    if tags.get("natural") == "water" or "waterway" in tags:
        return "water", tags.get("waterway", "water")
    if "leisure" in tags or "landuse" in tags:
        return "green", tags.get("leisure") or tags.get("landuse")
    if "amenity" in tags and tags.get("name"):
        return "place", tags["amenity"]  # colleges, schools, hospitals and so on
    return None


def build_map(lat, lon, label, elements):
    """Reduce raw OpenStreetMap ways to small, drawable features in local metres."""
    features, places = [], []
    for el in elements:
        geometry = el.get("geometry")
        kind = _kind(el.get("tags", {}))
        if not geometry or len(geometry) < 2 or not kind:
            continue
        points = []
        for g in geometry:
            x, y = to_local(g["lat"], g["lon"], lat, lon)
            point = [round(x, 1), round(y, 1)]
            if not points or point != points[-1]:
                points.append(point)
        if len(points) < 2:
            continue
        feature = {"k": kind[0], "c": kind[1], "p": points}
        name = str(el["tags"].get("name", ""))[:80]
        if name:
            feature["n"] = name
            if kind[0] == "road":  # label a road where it passes closest to the site
                cx, cy = min(points, key=lambda q: math.hypot(q[0], q[1]))
            else:
                cx = sum(p[0] for p in points) / len(points)
                cy = sum(p[1] for p in points) / len(points)
            places.append({"n": name, "k": kind[0], "x": round(cx, 1), "y": round(cy, 1), "d": round(math.hypot(cx, cy))})
        features.append(feature)
        if len(features) >= MAX_FEATURES:
            break
    nearest = {}  # one entry per name, the closest one
    for place in sorted(places, key=lambda p: p["d"]):
        nearest.setdefault(place["n"], place)
    places = list(nearest.values())[:14]
    return {
        "center": {"lat": round(lat, 6), "lon": round(lon, 6), "name": label},
        "radius": RADIUS_M,
        "features": features,
        "places": places,
        "source": "OpenStreetMap contributors (ODbL 1.0)",
        "fetchedAt": time.strftime("%Y-%m-%d", time.gmtime()),
    }


def _allow_fresh():
    now = time.monotonic()
    with _lock:
        _fresh[:] = [t for t in _fresh if now - t < 60]
        if len(_fresh) >= MAX_FRESH_LOOKUPS_PER_MIN:
            return False
        _fresh.append(now)
        return True


def lookup(raw_query):
    """Return a site map for a place name or 'lat, lon'; use the cache when it has one."""
    text = clean_query(raw_query)
    key = hashlib.sha1(text.lower().encode()).hexdigest()[:20]
    path = CACHE_DIR / f"{key}.json"
    if path.is_file():
        return json.loads(path.read_text(encoding="utf-8"))
    if not _allow_fresh():
        raise GeoError(429, "Too many new map lookups right now. Wait a minute and try again.")
    point = parse_latlon(text)
    if point:
        lat, lon, label = point[0], point[1], f"{point[0]:.5f}, {point[1]:.5f}"
    else:
        lat, lon, label = geocode(text)
    result = build_map(lat, lon, label, fetch_elements(lat, lon))
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(result, separators=(",", ":")), encoding="utf-8")
    except OSError:
        pass  # a read-only disk only costs the cache
    return result
