"""Check local Markdown links/anchors and executable architecture examples offline."""

import re
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    checked = 0
    documents = [*ROOT.glob("*.md"), *(ROOT / "docs").rglob("*.md")]
    for doc in documents:
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", doc.read_text(encoding="utf-8")):
            if "://" in target or target.startswith("mailto:"):
                continue
            filename, _, anchor = unquote(target).partition("#")
            linked = doc.parent / filename if filename else doc
            if not linked.exists():
                raise ValueError(f"Broken link in {doc.name}: {target}")
            if anchor and linked.suffix == ".md":
                headings = re.findall(r"^#{1,6}\s+(.+)$", linked.read_text(encoding="utf-8"), re.M)
                slugs = [re.sub(r"[^\w\- ]", "", h.lower()).replace(" ", "-") for h in headings]
                if anchor not in slugs:
                    raise ValueError(f"Broken anchor in {doc.name}: {target}")
            checked += 1
    examples = 0
    for block in re.findall(
        r"```python\n(.*?)```", (ROOT / "ARCHITECTURE.md").read_text(encoding="utf-8"), re.S
    ):
        # Only trusted, checked-in examples with imports; signature sketches are not code.
        if block.lstrip().startswith("from "):
            exec(compile(block, "ARCHITECTURE.md example", "exec"), {})
            examples += 1
    print(f"Passed: {checked} local documentation links/anchors; {examples} API examples.")


if __name__ == "__main__":
    main()
