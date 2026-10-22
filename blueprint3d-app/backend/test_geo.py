"""Site map tests. No network: the HTTP layer is replaced with canned answers."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geo

OVERPASS_WAYS = [
    {"tags": {"highway": "residential", "name": "Main Road"},
     "geometry": [{"lat": 13.0000, "lon": 80.0000}, {"lat": 13.0010, "lon": 80.0000}]},
    {"tags": {"building": "yes", "name": "Library"},
     "geometry": [{"lat": 13.0001, "lon": 80.0001}, {"lat": 13.0001, "lon": 80.0002},
                  {"lat": 13.0002, "lon": 80.0002}, {"lat": 13.0001, "lon": 80.0001}]},
    {"tags": {"natural": "water"},
     "geometry": [{"lat": 13.0003, "lon": 80.0003}, {"lat": 13.0003, "lon": 80.0004},
                  {"lat": 13.0004, "lon": 80.0004}, {"lat": 13.0003, "lon": 80.0003}]},
    {"tags": {"amenity": "bench"}, "geometry": [{"lat": 13.0, "lon": 80.0}, {"lat": 13.0, "lon": 80.0001}]},
    {"tags": {"amenity": "college", "name": "Test College"},
     "geometry": [{"lat": 13.0005, "lon": 80.0005}, {"lat": 13.0005, "lon": 80.0006},
                  {"lat": 13.0006, "lon": 80.0006}, {"lat": 13.0005, "lon": 80.0005}]},
    {"tags": {"building": "yes"}, "geometry": [{"lat": 13.0, "lon": 80.0}]},
]


def fake_http(url, body=None):
    if url.startswith(geo.NOMINATIM):
        return [{"lat": "13.0005", "lon": "80.0005", "display_name": "Test Campus, Chennai, India"}]
    return {"elements": OVERPASS_WAYS}


class GeoTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        patches = [mock.patch.object(geo, "CACHE_DIR", Path(self.tmp.name)),
                   mock.patch.object(geo, "_http", side_effect=fake_http),
                   mock.patch.object(geo, "MIN_GAP_S", 0)]
        self.http = patches[1].start()
        patches[0].start(); patches[2].start()
        self.addCleanup(mock.patch.stopall)
        self.addCleanup(self.tmp.cleanup)
        geo._fresh.clear()

    def test_queries_are_validated(self):
        for bad in ("", "ab", "x" * 201, "bad\x00name", None):
            with self.subTest(bad=bad), self.assertRaises(geo.GeoError) as ctx:
                geo.clean_query(bad)
            self.assertEqual(ctx.exception.status, 400)
        self.assertEqual(geo.clean_query("  Ramapuram,   Chennai "), "Ramapuram, Chennai")
        self.assertEqual(geo.clean_query("two\nlines\there"), "two lines here")

    def test_coordinates_are_parsed_and_range_checked(self):
        self.assertEqual(geo.parse_latlon("13.03, 80.18"), (13.03, 80.18))
        self.assertEqual(geo.parse_latlon("-33.9 151.2"), (-33.9, 151.2))
        self.assertIsNone(geo.parse_latlon("Chennai"))
        with self.assertRaises(geo.GeoError):
            geo.parse_latlon("95, 10")

    def test_local_projection_is_in_metres(self):
        east, north = geo.to_local(13.001, 80.0, 13.0, 80.0)
        self.assertAlmostEqual(north, 110.54, places=1)
        self.assertAlmostEqual(east, 0.0, places=6)
        east, _ = geo.to_local(13.0, 80.001, 13.0, 80.0)
        self.assertAlmostEqual(east, 108.46, delta=0.2)

    def test_build_map_keeps_drawable_features_only(self):
        m = geo.build_map(13.0, 80.0, "Test", OVERPASS_WAYS)
        self.assertEqual(sorted(f["k"] for f in m["features"]), ["building", "place", "road", "water"])
        # only named features are listed, nearest first; unnamed benches and water are not
        self.assertEqual([p["n"] for p in m["places"]], ["Main Road", "Library", "Test College"])
        road = next(f for f in m["features"] if f["k"] == "road")
        self.assertEqual(road["c"], "residential")
        self.assertEqual(road["p"][0], [0.0, 0.0])

    def test_lookup_geocodes_fetches_and_caches(self):
        first = geo.lookup("Test Campus")
        self.assertEqual(first["center"]["name"], "Test Campus, Chennai, India")
        calls = self.http.call_count
        again = geo.lookup("  test   campus ")
        self.assertEqual(again, first)
        self.assertEqual(self.http.call_count, calls, "a cached map must not call the network")

    def test_coordinates_skip_geocoding(self):
        geo.lookup("13.0005, 80.0005")
        urls = [c.args[0] for c in self.http.call_args_list]
        self.assertFalse(any(u.startswith(geo.NOMINATIM) for u in urls))

    def test_unknown_place_is_a_404(self):
        with mock.patch.object(geo, "_http", return_value=[]), self.assertRaises(geo.GeoError) as ctx:
            geo.lookup("nowhere at all")
        self.assertEqual(ctx.exception.status, 404)

    def test_fresh_lookups_are_rate_limited_but_cached_ones_are_not(self):
        for i in range(geo.MAX_FRESH_LOOKUPS_PER_MIN):
            geo.lookup(f"13.{i:04d}, 80.0000")
        with self.assertRaises(geo.GeoError) as ctx:
            geo.lookup("13.5000, 80.0000")
        self.assertEqual(ctx.exception.status, 429)
        geo.lookup("13.0000, 80.0000")  # already cached

    def test_overpass_falls_back_to_the_next_server(self):
        seen = []

        def flaky(url, body=None):
            seen.append(url)
            if url == geo.OVERPASS_SERVERS[0]:
                raise geo.GeoError(502, "down")
            return {"elements": OVERPASS_WAYS}

        with mock.patch.object(geo, "_http", side_effect=flaky):
            self.assertEqual(len(geo.fetch_elements(13.0, 80.0)), len(OVERPASS_WAYS))
        self.assertEqual(seen[:2], list(geo.OVERPASS_SERVERS[:2]))

    def test_validate_map_accepts_valid_map(self):
        m = geo.build_map(13.0, 80.0, "Test", OVERPASS_WAYS)
        self.assertTrue(geo.validate_map(m))

    def test_validate_map_rejects_invalid_maps(self):
        valid = geo.build_map(13.0, 80.0, "Test", OVERPASS_WAYS)

        with self.assertRaises(geo.GeoError):
            geo.validate_map("not a dict")

        # missing / bad center
        with self.assertRaises(geo.GeoError):
            bad = dict(valid)
            del bad["center"]
            geo.validate_map(bad)

        with self.assertRaises(geo.GeoError):
            bad = dict(valid)
            bad["center"] = {"lat": 95, "lon": 80.0, "name": "Out of bounds"}
            geo.validate_map(bad)

        with self.assertRaises(geo.GeoError):
            bad = dict(valid)
            bad["center"] = {"lat": 13.0, "lon": 195.0, "name": "Out of bounds"}
            geo.validate_map(bad)

        with self.assertRaises(geo.GeoError):
            bad = dict(valid)
            bad["center"] = {"lat": 13.0, "lon": 80.0, "name": "   "}
            geo.validate_map(bad)

        # non-positive or bad radius
        for bad_r in (0, -10, "300", None, True):
            with self.subTest(bad_r=bad_r), self.assertRaises(geo.GeoError):
                bad = dict(valid, radius=bad_r)
                geo.validate_map(bad)

        # invalid kind
        with self.assertRaises(geo.GeoError):
            bad = dict(valid, features=[{"k": "railway", "c": "track", "p": [[0.0, 0.0], [1.0, 1.0]]}])
            geo.validate_map(bad)

        # points too few
        with self.assertRaises(geo.GeoError):
            bad = dict(valid, features=[{"k": "road", "c": "primary", "p": [[0.0, 0.0]]}])
            geo.validate_map(bad)

        # bad coordinate types
        for bad_p in (
            [[0.0, "not a number"], [1.0, 1.0]],
            [[0.0, None], [1.0, 1.0]],
            [[True, 0.0], [1.0, 1.0]],
            [[0.0], [1.0, 1.0]],
            "not a list",
        ):
            with self.subTest(bad_p=bad_p), self.assertRaises(geo.GeoError):
                bad = dict(valid, features=[{"k": "road", "c": "primary", "p": bad_p}])
                geo.validate_map(bad)

        # points far outside the search area (wrong units or swapped axes)
        far = valid["radius"] * geo.MAX_EXTENT_FACTOR + 1
        with self.assertRaises(geo.GeoError):
            bad = dict(valid, features=[{"k": "road", "c": "primary", "p": [[0.0, 0.0], [far, 0.0]]}])
            geo.validate_map(bad)

        with self.assertRaises(geo.GeoError):
            bad = dict(valid, places=[{"n": "Spot", "k": "road", "x": far, "y": 0.0, "d": 5.0}])
            geo.validate_map(bad)

        # bad places
        with self.assertRaises(geo.GeoError):
            bad = dict(valid, places=[{"n": "Spot", "k": "unknown_kind", "x": 1.0, "y": 2.0, "d": 5.0}])
            geo.validate_map(bad)

        with self.assertRaises(geo.GeoError):
            bad = dict(valid, places=[{"n": "Spot", "k": "road", "x": 1.0, "y": 2.0, "d": -1.0}])
            geo.validate_map(bad)

        # bad source
        with self.assertRaises(geo.GeoError):
            bad = dict(valid, source="Google Maps proprietary")
            geo.validate_map(bad)

        # bad fetchedAt
        for bad_date in ("yesterday", "2026-02-31", "2026/10/22", 12345):
            with self.subTest(bad_date=bad_date), self.assertRaises(geo.GeoError):
                bad = dict(valid, fetchedAt=bad_date)
                geo.validate_map(bad)

    def test_bundled_regions_catalog_and_files_are_valid(self):
        root = Path(__file__).resolve().parent.parent
        manifest_path = root / "public" / "geo" / "regions.json"
        self.assertTrue(manifest_path.is_file(), f"Manifest file not found: {manifest_path}")

        regions = json.loads(manifest_path.read_text(encoding="utf-8"))
        self.assertIsInstance(regions, list)
        self.assertGreater(len(regions), 0, "regions.json catalog should not be empty")

        for region in regions:
            self.assertIn("id", region)
            self.assertIn("name", region)
            self.assertIn("file", region)
            self.assertTrue(region["id"].strip())
            self.assertTrue(region["name"].strip())
            self.assertTrue(region["file"].strip())

            region_path = manifest_path.parent / region["file"]
            self.assertTrue(region_path.is_file(), f"Bundled map file not found: {region_path}")
            data = json.loads(region_path.read_text(encoding="utf-8"))
            self.assertTrue(geo.validate_map(data))


if __name__ == "__main__":
    unittest.main()
