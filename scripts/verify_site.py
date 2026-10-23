"""Verify an anonymous HTTPS deployment against the local deterministic build."""

import argparse
import hashlib
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import urlopen


def verify(url: str, build: Path) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https" or not url.endswith("/") or parsed.query or parsed.fragment:
        raise ValueError("Use the exact HTTPS Pages URL, ending in /, without query or fragment")
    if parsed.username or parsed.password:
        raise ValueError("Verification must not use authentication")
    manifest_bytes = (build / "site-manifest.json").read_bytes()
    with urlopen(url + "site-manifest.json", timeout=30) as response:
        assert response.status == 200
        assert response.read() == manifest_bytes, "Published manifest differs from local build"
    files = json.loads(manifest_bytes)["files"]
    checked = 0
    for name, expected in files.items():
        if name == ".nojekyll":  # Host build marker, not an application resource.
            continue
        with urlopen(url + name, timeout=30) as response:
            assert response.status == 200
            assert hashlib.sha256(response.read()).hexdigest() == expected, name
        checked += 1
    for name in (".git/config", ".env", "PROGRESS.md", "package.json", "tests/test_browser.py",
                 "scripts/build_site.py", "scripts/app.js.map", "src/schengenstay/models.py"):
        try:
            with urlopen(url + name, timeout=30) as response:
                raise AssertionError(f"Unexpected public development resource: {name}")
        except HTTPError as error:
            assert error.code == 404, f"{name}: HTTP {error.code}"
    print(f"Anonymous HTTPS verification passed: manifest + {checked} resource digests; "
          "8 development/private paths return 404.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="Actual Pages html_url read from GitHub settings/API")
    parser.add_argument("--build", type=Path, default=Path("dist/site"))
    args = parser.parse_args()
    verify(args.url, args.build)
