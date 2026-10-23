"""Publication must never pick up private files or depend on checkout newlines."""

import hashlib
import json
import runpy
import shutil
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
builder = runpy.run_path(str(ROOT / "scripts/build_site.py"))


@pytest.fixture
def source(tmp_path):
    root = tmp_path / "source"
    shutil.copytree(ROOT / "web", root / "web")
    for name in ("LICENSE", "pyproject.toml"):
        shutil.copyfile(ROOT / name, root / name)
    return root


def test_build_is_deterministic_and_has_a_complete_manifest(source, tmp_path):
    original = builder["site_files"](source)
    for file in (source / "web").rglob("*"):
        if file.is_file() and file.suffix != ".zip":
            text = file.read_text(encoding="utf-8")
            file.write_bytes(text.replace("\n", "\r\n").encode())
    assert builder["site_files"](source) == original
    manifest = json.loads(original["site-manifest.json"])
    assert manifest["version"] == "1.0.0"
    assert set(original) == {*manifest["files"], "site-manifest.json"}
    for name, digest in manifest["files"].items():
        assert hashlib.sha256(original[name]).hexdigest() == digest
    output = tmp_path / "site"
    builder["build"](output, root=source)
    builder["build"](output, check=True, root=source)
    (output / "index.html").write_text("corrupt", encoding="utf-8")
    with pytest.raises(ValueError, match="differs"):
        builder["build"](output, check=True, root=source)


@pytest.mark.parametrize("name", [".env", "scripts/debug.js.map", "personal.json", "README.md"])
def test_unreviewed_files_block_the_build(source, name):
    (source / "web" / name).write_text("synthetic test file", encoding="utf-8")
    with pytest.raises(ValueError, match="Unreviewed"):
        builder["site_files"](source)


def test_leftover_output_and_license_drift_block_publication(source, tmp_path):
    output = tmp_path / "site"
    output.mkdir()
    (output / "private.txt").write_text("synthetic", encoding="utf-8")
    with pytest.raises(ValueError, match="Unexpected"):
        builder["build"](output, root=source)
    (source / "LICENSE").write_text("changed", encoding="utf-8")
    with pytest.raises(ValueError, match="MIT notice"):
        builder["site_files"](source)
