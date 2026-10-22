"""Build/check a deterministic source archive, served with the static frontend."""

import argparse
import io
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "web/python/schengenstay.zip"


def archive_bytes(source_dir: Path = ROOT / "src/schengenstay") -> bytes:
    stream = io.BytesIO()
    # This small source bundle must compare byte-for-byte across hosts. Stored
    # entries avoid compressor-version differences; all metadata is canonical.
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_STORED) as archive:
        for path in sorted(source_dir.glob("*.py")):
            info = zipfile.ZipInfo(f"schengenstay/{path.name}", (2026, 1, 1, 0, 0, 0))
            info.create_system = 3  # Unix metadata on every build host, including Windows.
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_text(encoding="utf-8").replace("\r\n", "\n"))
    return stream.getvalue()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    content = archive_bytes()
    if args.check:
        if not TARGET.exists() or TARGET.read_bytes() != content:
            raise SystemExit("Browser archive is stale; run python scripts/build_browser.py")
        print("Browser archive matches Python source.")
    else:
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        TARGET.write_bytes(content)
        print(f"Built {TARGET.relative_to(ROOT)} ({len(content)} bytes).")
