from __future__ import annotations

import subprocess
from pathlib import Path, PurePosixPath


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DISALLOWED_NAMES = {".DS_Store", "Thumbs.db"}
DISALLOWED_DIRS = {"__pycache__", ".pytest_cache", ".wrangler"}
DISALLOWED_SUFFIXES = {".pyc", ".pyo"}


def list_repo_paths(root: Path) -> list[str]:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), "ls-files", "--cached", "--others", "--exclude-standard"],
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return []
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def find_disallowed_paths(paths: list[str]) -> list[str]:
    violations: list[str] = []
    for raw_path in paths:
        parts = PurePosixPath(raw_path).parts
        name = parts[-1] if parts else raw_path
        if name in DISALLOWED_NAMES:
            violations.append(raw_path)
            continue
        if any(part in DISALLOWED_DIRS for part in parts):
            violations.append(raw_path)
            continue
        if any(part.startswith(".venv") for part in parts):
            violations.append(raw_path)
            continue
        if Path(name).suffix in DISALLOWED_SUFFIXES:
            violations.append(raw_path)
    return sorted(set(violations))


def main() -> int:
    repo_paths = list_repo_paths(PROJECT_ROOT)
    violations = find_disallowed_paths(repo_paths)
    if violations:
        print("Disallowed files are present in the git-visible worktree:")
        for path in violations:
            print(f"- {path}")
        return 1
    print("Repo hygiene check passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
