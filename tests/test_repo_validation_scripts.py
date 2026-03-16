from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "scripts"))

from check_repo_hygiene import find_disallowed_paths  # noqa: E402
from validate_readme_links import validate_markdown_links  # noqa: E402


class RepoValidationScriptsTest(unittest.TestCase):
    def test_find_disallowed_paths_flags_cache_and_local_junk(self) -> None:
        violations = find_disallowed_paths(
            [
                "README.md",
                "tests/__pycache__/test_sample.pyc",
                "site/.DS_Store",
                ".venv/bin/python",
            ]
        )
        self.assertEqual(
            violations,
            [
                ".venv/bin/python",
                "site/.DS_Store",
                "tests/__pycache__/test_sample.pyc",
            ],
        )

    def test_validate_markdown_links_accepts_existing_local_links(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            docs = root / "docs"
            docs.mkdir()
            (docs / "guide.md").write_text("# Guide Title\n", encoding="utf-8")
            readme = root / "README.md"
            readme.write_text(
                "# Home\n\n[Guide](docs/guide.md#guide-title)\n![Preview](docs/guide.md)\n[Section](#home)\n",
                encoding="utf-8",
            )

            self.assertEqual(validate_markdown_links(readme), [])

    def test_validate_markdown_links_flags_missing_target(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            readme = Path(temp_dir) / "README.md"
            readme.write_text("# Home\n\n[Missing](docs/missing.md)\n", encoding="utf-8")
            errors = validate_markdown_links(readme)
            self.assertEqual(len(errors), 1)
            self.assertIn("docs/missing.md", errors[0])


if __name__ == "__main__":
    unittest.main()
