"""The static Python bundle is identical across operating systems and checkouts."""

import io
import runpy
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
archive_bytes = runpy.run_path(str(ROOT / "scripts/build_browser.py"))["archive_bytes"]


def test_archive_is_identical_across_platforms_and_checkout_line_endings(tmp_path, monkeypatch):
    lf, crlf = tmp_path / "lf", tmp_path / "crlf"
    lf.mkdir()
    crlf.mkdir()
    sources = {"z.py": "# Unicode: поездка\nvalue = 90\n", "__init__.py": "from .z import value\n"}
    # Deliberately create files out of lexical order; archive entries must be sorted.
    for name, source in sources.items():
        (lf / name).write_bytes(source.encode("utf-8"))
        (crlf / name).write_bytes(source.replace("\n", "\r\n").encode("utf-8"))
    (lf / "private.txt").write_text("Must not enter the Python bundle", encoding="utf-8")
    builds = []
    for platform in ("win32", "linux", "darwin"):
        with monkeypatch.context() as context:
            context.setattr(sys, "platform", platform)
            builds.extend(archive_bytes(source_dir) for source_dir in (lf, crlf))
    assert all(build == builds[0] for build in builds)
    with zipfile.ZipFile(io.BytesIO(builds[0])) as archive:
        assert archive.namelist() == [f"schengenstay/{name}" for name in sorted(sources)]
        for info in archive.infolist():
            assert info.create_system == 3
            assert info.compress_type == zipfile.ZIP_STORED
            assert info.date_time == (2026, 1, 1, 0, 0, 0)
            assert info.external_attr == 0o644 << 16
            assert info.extra == info.comment == b""
            assert archive.read(info) == sources[Path(info.filename).name].encode("utf-8")


def test_source_changes_still_change_archive_bytes(tmp_path):
    source = tmp_path / "example.py"
    source.write_text("value = 90\n", encoding="utf-8")
    original = archive_bytes(tmp_path)
    source.write_text("value = 91\n", encoding="utf-8")
    assert archive_bytes(tmp_path) != original


@pytest.mark.parametrize("platform", ["win32", "linux", "darwin"])
def test_committed_archive_matches_current_source_on_every_platform(platform, monkeypatch):
    expected = (ROOT / "web/python/schengenstay.zip").read_bytes()
    with monkeypatch.context() as context:
        context.setattr(sys, "platform", platform)
        assert archive_bytes() == expected
