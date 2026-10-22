"""Unit tests for backend/fetch_region.py."""
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import fetch_region
import geo

OVERPASS_WAYS = [
    {
        "tags": {"highway": "residential", "name": "Main Road"},
        "geometry": [{"lat": 13.0000, "lon": 80.0000}, {"lat": 13.0010, "lon": 80.0000}],
    },
    {
        "tags": {"building": "yes", "name": "Library"},
        "geometry": [
            {"lat": 13.0001, "lon": 80.0001},
            {"lat": 13.0001, "lon": 80.0002},
            {"lat": 13.0002, "lon": 80.0002},
            {"lat": 13.0001, "lon": 80.0001},
        ],
    },
    {
        "tags": {"natural": "water"},
        "geometry": [
            {"lat": 13.0003, "lon": 80.0003},
            {"lat": 13.0003, "lon": 80.0004},
            {"lat": 13.0004, "lon": 80.0004},
            {"lat": 13.0003, "lon": 80.0003},
        ],
    },
    {
        "tags": {"amenity": "college", "name": "Test College"},
        "geometry": [
            {"lat": 13.0005, "lon": 80.0005},
            {"lat": 13.0005, "lon": 80.0006},
            {"lat": 13.0006, "lon": 80.0006},
            {"lat": 13.0005, "lon": 80.0005},
        ],
    },
]


def fake_http_success(url, body=None):
    if url.startswith(geo.NOMINATIM):
        return [{"lat": "13.0005", "lon": "80.0005", "display_name": "Test Campus, Chennai, India"}]
    return {"elements": OVERPASS_WAYS}


class FetchRegionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.geo_dir = Path(self.tmp.name) / "public" / "geo"
        self.geo_dir.mkdir(parents=True, exist_ok=True)

        patches = [
            mock.patch.object(geo, "CACHE_DIR", self.geo_dir / "cache"),
            mock.patch.object(geo, "_http", side_effect=fake_http_success),
            mock.patch.object(geo, "MIN_GAP_S", 0),
        ]
        self.http_mock = patches[1].start()
        patches[0].start()
        patches[2].start()
        self.addCleanup(mock.patch.stopall)
        self.addCleanup(self.tmp.cleanup)
        geo._fresh.clear()

    def test_successful_fetch_by_place_name(self):
        data = fetch_region.fetch_and_bundle(
            "SRM Easwari Engineering College, Ramapuram, Chennai",
            geo_dir=self.geo_dir,
        )
        self.assertTrue(geo.validate_map(data))
        self.assertEqual(data["center"]["name"], "Test Campus, Chennai, India")

        # Check file written to disk
        files = list(self.geo_dir.glob("*.json"))
        # Should have the map json and regions.json
        map_files = [f for f in files if f.name != "regions.json"]
        self.assertEqual(len(map_files), 1)
        written_data = json.loads(map_files[0].read_text(encoding="utf-8"))
        self.assertTrue(geo.validate_map(written_data))

        # Check regions.json catalog
        catalog_path = self.geo_dir / "regions.json"
        self.assertTrue(catalog_path.is_file())
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        self.assertEqual(len(catalog), 1)
        self.assertEqual(catalog[0]["file"], map_files[0].name)
        self.assertEqual(catalog[0]["name"], "Test Campus, Chennai, India")

    def test_successful_fetch_by_coordinates_with_custom_name_via_cli(self):
        stderr = io.StringIO()
        with mock.patch("sys.stderr", stderr):
            code = fetch_region.main([
                "13.0005, 80.0005",
                "chennai-campus.json",
                "--name",
                "Chennai Campus",
                "--geo-dir",
                str(self.geo_dir),
            ])

        self.assertEqual(code, 0)
        out_file = self.geo_dir / "chennai-campus.json"
        self.assertTrue(out_file.is_file())
        data = json.loads(out_file.read_text(encoding="utf-8"))
        self.assertTrue(geo.validate_map(data))
        self.assertEqual(data["center"]["name"], "Chennai Campus")

        catalog = json.loads((self.geo_dir / "regions.json").read_text(encoding="utf-8"))
        self.assertEqual(len(catalog), 1)
        self.assertEqual(catalog[0], {
            "id": "chennai-campus",
            "name": "Chennai Campus",
            "file": "chennai-campus.json",
        })

    def test_fallback_when_first_overpass_server_fails(self):
        tried_servers = []

        def flaky_http(url, body=None):
            if url.startswith(geo.NOMINATIM):
                return [{"lat": "13.0005", "lon": "80.0005", "display_name": "Test Site"}]
            tried_servers.append(url)
            if url == geo.OVERPASS_SERVERS[0]:
                raise geo.GeoError(502, "server 0 down")
            return {"elements": OVERPASS_WAYS}

        with mock.patch.object(geo, "_http", side_effect=flaky_http):
            code = fetch_region.main([
                "13.0005, 80.0005",
                "fallback.json",
                "--geo-dir",
                str(self.geo_dir),
            ])

        self.assertEqual(code, 0)
        self.assertEqual(tried_servers[:2], list(geo.OVERPASS_SERVERS[:2]))
        out_file = self.geo_dir / "fallback.json"
        self.assertTrue(out_file.is_file())
        data = json.loads(out_file.read_text(encoding="utf-8"))
        self.assertTrue(geo.validate_map(data))

    def test_error_reporting_when_all_overpass_servers_fail(self):
        def all_fail_http(url, body=None):
            if url.startswith(geo.NOMINATIM):
                return [{"lat": "13.0005", "lon": "80.0005", "display_name": "Test Site"}]
            raise geo.GeoError(502, "mirror busy")

        stderr = io.StringIO()
        with mock.patch.object(geo, "_http", side_effect=all_fail_http), mock.patch("sys.stderr", stderr):
            code = fetch_region.main([
                "13.0005, 80.0005",
                "all-fail.json",
                "--geo-dir",
                str(self.geo_dir),
            ])

        self.assertEqual(code, 1)
        err_msg = stderr.getvalue()
        self.assertIn("mirror busy", err_msg)
        # Ensure file was not created
        self.assertFalse((self.geo_dir / "all-fail.json").is_file())

    def test_invalid_input_handling(self):
        cases = [
            ("", "3 to 200 characters"),
            ("ab", "3 to 200 characters"),
            ("bad\x00query", "3 to 200 characters"),
            ("95.0, 10.0", "Latitude must be within 85 degrees"),
            ("13.0, 200.0", "Latitude must be within 85 degrees"),
        ]

        for bad_query, expected_err in cases:
            with self.subTest(bad_query=bad_query):
                stderr = io.StringIO()
                with mock.patch("sys.stderr", stderr):
                    code = fetch_region.main([
                        bad_query,
                        "--geo-dir",
                        str(self.geo_dir),
                    ])
                self.assertEqual(code, 1)
                self.assertIn(expected_err, stderr.getvalue())

    def test_unknown_place_geocoding_failure(self):
        def not_found_http(url, body=None):
            return []

        stderr = io.StringIO()
        with mock.patch.object(geo, "_http", side_effect=not_found_http), mock.patch("sys.stderr", stderr):
            code = fetch_region.main([
                "Nonexistent Faraway Place XYZ 123",
                "--geo-dir",
                str(self.geo_dir),
            ])
        self.assertEqual(code, 1)
        self.assertIn("That place was not found", stderr.getvalue())

    def test_catalog_update_and_deduplication(self):
        catalog_path = self.geo_dir / "regions.json"
        initial_catalog = [
            {
                "id": "srm-easwari",
                "name": "SRM Easwari Engineering College, Ramapuram, Chennai",
                "file": "sample-chennai.json",
            }
        ]
        catalog_path.write_text(json.dumps(initial_catalog, indent=2) + "\n", encoding="utf-8")

        # 1. Update existing entry by matching filename
        code = fetch_region.main([
            "13.0005, 80.0005",
            "sample-chennai.json",
            "--name",
            "Updated Campus Display Name",
            "--geo-dir",
            str(self.geo_dir),
        ])
        self.assertEqual(code, 0)

        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        self.assertEqual(len(catalog), 1, "Should update existing entry, not duplicate")
        self.assertEqual(catalog[0]["id"], "srm-easwari")
        self.assertEqual(catalog[0]["name"], "Updated Campus Display Name")
        self.assertEqual(catalog[0]["file"], "sample-chennai.json")

        # 2. Append a new entry
        code2 = fetch_region.main([
            "13.0000, 80.0000",
            "second-campus.json",
            "--name",
            "Second Campus",
            "--geo-dir",
            str(self.geo_dir),
        ])
        self.assertEqual(code2, 0)

        catalog2 = json.loads(catalog_path.read_text(encoding="utf-8"))
        self.assertEqual(len(catalog2), 2)
        self.assertEqual(catalog2[1], {
            "id": "second-campus",
            "name": "Second Campus",
            "file": "second-campus.json",
        })

    def test_slugify_helper(self):
        self.assertEqual(fetch_region.slugify("Hello World!"), "hello-world")
        self.assertEqual(fetch_region.slugify("SRM Easwari, Ramapuram"), "srm-easwari-ramapuram")
        self.assertEqual(fetch_region.slugify("13.0337, 80.1800"), "13-0337-80-1800")
        self.assertEqual(fetch_region.slugify("---test---"), "test")
        self.assertEqual(fetch_region.slugify("!!!"), "region")


if __name__ == "__main__":
    unittest.main()
