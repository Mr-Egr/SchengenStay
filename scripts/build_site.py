"""Produce/check an allowlisted, deterministic GitHub Pages directory."""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE_FILES = tuple("""
index.html LICENSE.txt THIRD_PARTY_NOTICES.txt
assets/journey.svg assets/mark.svg styles/main.css python/schengenstay.zip
licenses/PYODIDE-MPL-2.0.txt licenses/CPYTHON-3.14.2.txt licenses/EMSCRIPTEN-5.0.3.txt
scripts/app.js scripts/bootstrap.js scripts/components.js scripts/context-i18n.js
scripts/context-ui.js scripts/date-input.js scripts/dates.js scripts/dom.js
scripts/i18n.js scripts/integration-i18n.js scripts/pyodide-bridge.js
scripts/python-worker.js scripts/results.js scripts/storage.js scripts/store.js
scripts/views.js
""".split())


def canonical(path: Path) -> bytes:
    data = path.read_bytes()
    return data if path.suffix == ".zip" else data.decode("utf-8").replace("\r\n", "\n").encode()


def site_files(root: Path = ROOT) -> dict[str, bytes]:
    web = root / "web"
    actual = set()
    for path in web.rglob("*"):
        if path.is_symlink():
            raise ValueError("Symlinks are forbidden in site inputs")
        if path.is_file():
            actual.add(path.relative_to(web).as_posix())
    if actual != set(SITE_FILES):
        raise ValueError(f"Unreviewed or missing web files: {sorted(actual ^ set(SITE_FILES))}")
    files = {name: canonical(web / name) for name in sorted(SITE_FILES)}
    if files["LICENSE.txt"] != canonical(root / "LICENSE"):
        raise ValueError("Website MIT notice differs from root LICENSE")
    version = tomllib.loads((root / "pyproject.toml").read_text(encoding="utf-8"))["project"]["version"]
    files[".nojekyll"] = b""
    manifest = {"version": version, "files": {
        name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())
    }}
    files["site-manifest.json"] = (json.dumps(manifest, indent=2, sort_keys=True) + "\n").encode()
    return files


def build(output: Path, *, check: bool = False, root: Path = ROOT) -> None:
    files = site_files(root)
    # Never clean arbitrary directories or silently include leftovers in deployment.
    if output.is_symlink() or any(p.is_symlink() for p in output.rglob("*")):
        raise ValueError("Symlinks are forbidden in the output directory")
    existing = {p.relative_to(output).as_posix() for p in output.rglob("*") if p.is_file()}
    if existing - files.keys():
        raise ValueError("Unexpected output files; use a new empty output directory")
    if check:
        if existing != files.keys() or any((output / n).read_bytes() != b for n, b in files.items()):
            raise ValueError("Static build differs from reviewed source")
    else:
        for name, content in files.items():
            target = output / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            os.utime(target, (1767225600, 1767225600))
    print(f"{'Verified' if check else 'Built'} {len(files)} site files ({sum(map(len, files.values()))} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "dist/site")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    subprocess.run([sys.executable, str(ROOT / "scripts/build_browser.py"), "--check"], check=True)
    build(args.output.resolve(), check=args.check)
