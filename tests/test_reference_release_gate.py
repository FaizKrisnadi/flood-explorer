from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))

from build_reference_geoparquet import build_coverage_report  # noqa: E402


class ReferenceReleaseGateTest(unittest.TestCase):
    def test_release_gate_warns_when_district_threshold_not_met(self) -> None:
        admin_rows = [
            {"code": "31", "name": "DKI Jakarta", "level": "province", "province_code": "31", "regency_code": None, "district_code": None, "village_code": None},
            {"code": "31.01", "name": "Jakarta Example", "level": "regency", "province_code": "31", "regency_code": "31.01", "district_code": None, "village_code": None},
            {"code": "31.01.01", "name": "District A", "level": "district", "province_code": "31", "regency_code": "31.01", "district_code": "31.01.01", "village_code": None},
            {"code": "31.01.02", "name": "District B", "level": "district", "province_code": "31", "regency_code": "31.01", "district_code": "31.01.02", "village_code": None},
            {"code": "31.01.01.1001", "name": "Village A", "level": "village", "province_code": "31", "regency_code": "31.01", "district_code": "31.01.01", "village_code": "31.01.01.1001"},
        ]
        boundary_rows = {
            "province": [{"code": "31", "province_code": "31", "boundary_source": "raw"}],
            "regency": [{"code": "31.01", "province_code": "31", "boundary_source": "raw"}],
            "district": [{"code": "31.01.01", "province_code": "31", "boundary_source": "raw"}],
            "village": [{"code": "31.01.01.1001", "province_code": "31", "boundary_source": "raw"}],
        }

        report = build_coverage_report(admin_rows, boundary_rows)

        self.assertFalse(report["release_gate"]["district_release_ready"])
        self.assertEqual(report["release_gate"]["warning_code"], "district_threshold_not_met")


if __name__ == "__main__":
    unittest.main()
