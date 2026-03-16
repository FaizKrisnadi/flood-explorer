from __future__ import annotations

import re
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MARKDOWN_LINK_RE = re.compile(r"(?<!!)\[[^\]]*\]\(([^)]+)\)")
MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
HTML_ATTR_RE = re.compile(r"""(?:href|src)=["']([^"']+)["']""")
HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)


def slugify_heading(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text.strip("-")


def collect_heading_anchors(text: str) -> set[str]:
    return {slugify_heading(match.group(2)) for match in HEADING_RE.finditer(text)}


def extract_targets(text: str) -> list[str]:
    targets = MARKDOWN_LINK_RE.findall(text)
    targets.extend(MARKDOWN_IMAGE_RE.findall(text))
    targets.extend(HTML_ATTR_RE.findall(text))
    return [target.strip().strip("<>") for target in targets]


def validate_markdown_links(path: Path) -> list[str]:
    errors: list[str] = []
    text = path.read_text(encoding="utf-8")
    anchors = collect_heading_anchors(text)
    for target in extract_targets(text):
        if not target or target.startswith(("http://", "https://", "mailto:", "tel:")):
            continue
        if target.startswith("#"):
            anchor = target[1:]
            if anchor and anchor not in anchors:
                errors.append(f"Missing heading anchor in {path.name}: #{anchor}")
            continue

        relative_target, _, anchor = target.partition("#")
        target_path = (path.parent / relative_target).resolve()
        if not target_path.exists():
            errors.append(f"Missing linked file from {path.name}: {relative_target}")
            continue
        if anchor and target_path.suffix.lower() == ".md":
            target_anchors = collect_heading_anchors(target_path.read_text(encoding="utf-8"))
            if anchor not in target_anchors:
                errors.append(f"Missing heading anchor in {relative_target}: #{anchor}")
    return errors


def main(argv: list[str]) -> int:
    relative_path = argv[1] if len(argv) > 1 else "README.md"
    path = (PROJECT_ROOT / relative_path).resolve()
    errors = validate_markdown_links(path)
    if errors:
        print("README link validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Link validation passed for {path.relative_to(PROJECT_ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
