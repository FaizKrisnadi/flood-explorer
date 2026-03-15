from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))

from pipeline_utils import classify_code, extract_insert_tuples, swap_lat_lng  # noqa: E402


class PipelineUtilsTest(unittest.TestCase):
    def test_extract_insert_tuples_parses_multiple_rows(self) -> None:
        sql = """
        INSERT INTO demo VALUES
        ('31', 'DKI Jakarta'),
        ('31.01', 'Kepulauan Seribu'),
        ('31.01.01', 'Pademangan''s Test');
        """
        rows = extract_insert_tuples(sql)
        self.assertEqual(
            rows,
            [
                ["31", "DKI Jakarta"],
                ["31.01", "Kepulauan Seribu"],
                ["31.01.01", "Pademangan's Test"],
            ],
        )

    def test_classify_code_returns_hierarchy(self) -> None:
        self.assertEqual(classify_code("31"), ("province", "31", None, None))
        self.assertEqual(classify_code("31.74"), ("regency", "31", "31.74", None))
        self.assertEqual(classify_code("31.74.08"), ("district", "31", "31.74", "31.74.08"))
        self.assertEqual(classify_code("31.74.08.1001"), ("village", "31", "31.74", "31.74.08"))

    def test_swap_lat_lng_recurses(self) -> None:
        raw = [[[[-6.1, 106.8], [-6.2, 106.9], [-6.1, 106.8]]]]
        swapped = swap_lat_lng(raw)
        self.assertEqual(swapped[0][0][0], [106.8, -6.1])


if __name__ == "__main__":
    unittest.main()
