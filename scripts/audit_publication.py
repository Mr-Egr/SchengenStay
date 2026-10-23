"""Targeted publication scan of all reachable Git blobs and candidate files.

Print only finding categories/paths, never suspected secret contents. This is an
additional gate, not proof of absence or a replacement for human data/asset review.
"""

import io
import re
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATTERNS = {
    "private key": rb"-----BEGIN (?:RSA |DSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----",
    "GitHub token": rb"\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b",
    "AWS access key": rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b",
    "Slack token": rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b",
    "Google API key": rb"\bAIza[A-Za-z0-9_-]{35}\b",
    "credential URL": rb"https?://[^\s/:<>]+:[^\s/@<>]{8,}@",
    "credential assignment": rb"(?i)(?:api_key|access_token|secret_key|password)\s*[:=]\s*['\"][A-Za-z0-9_+/=-]{20,}['\"]",
}
PRIVATE_PATH = re.compile(
    r"(^|/)(\.env(?:\..*)?|\.aws|\.ssh|credentials[^/]*|secrets|node_modules|"
    r"\.venv|__pycache__|\.pytest_cache)(/|$)|\.(pem|key|pfx|p12|docx|pdf|sqlite|db)$", re.I
)


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def inspect(data: bytes, name: str, findings: set[str]) -> None:
    if PRIVATE_PATH.search(name):
        findings.add(f"Review private/development path: {name}")
    for category, pattern in PATTERNS.items():
        if re.search(pattern, data):
            findings.add(f"Review {category}: {name}")
    if data.startswith(b"PK\x03\x04"):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for info in archive.infolist():
                if info.file_size > 2_000_000 or info.filename.startswith("/") or ".." in Path(info.filename).parts:
                    findings.add(f"Review archive entry: {name}")
                    continue
                inspect(archive.read(info), f"{name}!/{info.filename}", findings)


def main() -> None:
    findings: set[str] = set()
    objects = git("rev-list", "--objects", "--all").splitlines()
    count = 0
    binaries = set()
    for line in objects:
        oid, _, name = line.partition(b" ")
        if git("cat-file", "-t", oid.decode()).strip() != b"blob":
            continue
        data = git("cat-file", "blob", oid.decode())
        label = name.decode("utf-8", errors="replace")
        inspect(data, label, findings)
        if b"\0" in data and not label.endswith(".zip"):
            binaries.add(label)
        count += 1
    candidates = git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split(b"\0")
    checked = 0
    for entry in filter(None, candidates):
        name = entry.decode("utf-8")
        path = ROOT / name
        if path.is_symlink():
            findings.add(f"Review symbolic link: {name}")
        elif path.is_file():
            inspect(path.read_bytes(), name, findings)
            checked += 1
    print(f"Scanned {count} reachable Git blobs and {checked} candidate files.")
    print(f"Binary paths requiring visual/format review: {sorted(binaries)}")
    if findings:
        raise SystemExit("\n".join(sorted(findings)))
    print("No targeted credential/private-path pattern matches. Manual review remains necessary.")


if __name__ == "__main__":
    main()
