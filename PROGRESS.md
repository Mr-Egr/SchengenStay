# Progress record

## 2026-10-22 — Initial commit preparation

Prepared the actual current Stage 0 and Stage 1 state for one initial local commit,
without reconstructing earlier commits. Expanded `.gitignore` for environments,
caches, logs, temporary files, packaging/build output, coverage, local settings,
credential stores, and private keys. Sanitized `.env` example templates remain
eligible for tracking. Preserved all source, tests, requirements, and CI files.

Reviewed the 22 candidate files and scanned for common credential patterns,
private keys, email addresses, personal-data fields, embedded URL credentials,
and machine-specific paths. The only flagged content was a local runtime path
in this historical log, replaced with a portable variable reference. No obvious
credentials, personal records, binary files, or generated artifacts were found
among the candidates. Pattern scanning is not a guarantee that arbitrary secrets
can never appear in source; review remains necessary for future additions.

Git's effective author and committer identities were configured and did not
appear to be placeholders. No identity or timestamp configuration was changed.
No remote was configured and no push or hosted repository creation was requested.

Checks run against this state on Python 3.12.14:

| Command/check | Result |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q` | 116 passed in 3.14 seconds |
| `.\.venv\Scripts\ruff.exe check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found |
| Ignore-rule verification | 49 excluded examples matched; all 22 project files and sanitized environment template names remain eligible |

## 2026-10-22 — Stage 1

Implemented only the pure Python date engine after rereading the requirements.
The original five documents, dependency declarations, and CI workflow remain
unchanged. No new dependencies, services, commits, remote pushes, or deployments.

### Changed files

| File | Change |
| --- | --- |
| `src/schengenstay/dates.py` | New strict ISO parser, closed interval model, inclusive lengths, full rolling windows, interval union, and unique window counts |
| `src/schengenstay/models.py` | New frozen completed/ongoing inputs and arithmetic-only usage result |
| `src/schengenstay/validation.py` | New typed issues, input bounds, duplicate-ID and overlap validation, explicit ongoing-date requirements, and validation exception |
| `src/schengenstay/calculator.py` | New validated `usage_on()` snapshot with arithmetic remainder and reported ongoing assumptions |
| `src/schengenstay/__init__.py` | Export Stage 1 models, usage function, validation, and issue types |
| `src/schengenstay/contracts.py` | Clarify that compliance status codes are reserved for later use |
| `tests/test_dates.py` | New calendar, parser, inclusive-boundary, normalization, and extreme-date unit tests |
| `tests/test_validation.py` | New malformed input, overlap, duplicate, ongoing, and history-limit tests |
| `tests/test_calculator.py` | New manually counted usage, 90/91-day, expiry, future-date, and ongoing tests |
| `tests/test_properties.py` | Seven independent-oracle and invariant properties, 200 passing generated examples each |
| `README.md` | Current API, boundaries, algorithm, error behavior, and verification scope |
| `CONTRIBUTING.md` | Stage 1 scope and independent-oracle guidance |
| `PROGRESS.md` | This implementation and verification record |

### Decisions

- `usage_on()` returns counts, dates, scope notes, and ongoing IDs, not a compliance
  status. `ResultStatus` remains reserved for later compliance APIs.
- Validate every supplied record before counting, including records outside the
  selected window. Invalid or overlapping history raises `HistoryValidationError`
  with structured `.issues`; low-level interval math independently deduplicates
  coverage. Shared entry/exit dates are overlaps; consecutive dates are not.
- Ongoing stays require explicit `as_of`/check date. No current clock or invented
  exit date is used; returned IDs identify assumed presence through the check date.
- Accept at most 500 history records, following the architecture's suggested cap.
  Date endpoints use Python's full date range; check dates must be at least
  `0001-06-29` so a full 180-day window is representable. These are computational
  bounds, not support for historical legal regimes.
- Count clipped, normalized interval lengths in O(n log n) time and O(n) memory;
  do not enumerate every day of arbitrarily long history.

### Verification actually run

Used the existing isolated environment with Python 3.12.14. Tests were written
before engine implementation; the first `python -m pytest -q` run failed with
four expected collection/import errors because the new modules did not yet exist.
After implementation, 111 tests passed. The first Ruff run found two test-style
issues (import grouping and explicit `zip(strict=False)`); both were corrected.
Added remaining validation/overlap properties and formatted the new files.

Final checks:

| Command | Local outcome |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q --hypothesis-show-statistics` | 116 passed in 2.16 seconds; all 7 properties reached 200 passing examples, 1,400 total |
| `.\.venv\Scripts\ruff.exe check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found |

Hypothesis discarded some generated candidates, reported as invalid test cases;
these were not failing examples. Each property reached its 200-example target.
The oracle explicitly enumerates dates without calling production normalization
or intersection code. Tests cover exact rolling-window boundaries, one-day and
empty histories, leap/century years, new year/month boundaries, 90th/91st-day
counts, gradual expiry after time outside, future-date clipping, overlapping and
duplicate coverage, bounded input, ongoing assumptions, immutability, and extreme
calendar dates. No network is used by the engine or tests.

### Reference review and remaining work

Reviewed the [European Commission calculator page](https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en)
on 2026-10-22 for the rolling-day principle. The manual URL in CALCULATION_RULES.md
returned HTTP 429 via the browsing tool. Tests are synthetic/manual arithmetic
fixtures, not verified official examples. Official example parity and live
calculator comparison remain open for Stage 2 and the release gates.

No Stage 1 test or lint failures remain. Future work includes compliance/status
precedence, historical violation reporting, legal-scope handling, planning,
browser integration, and release validation. The existing workflow will discover
the new tests but has not been run remotely. Licensing and fully locking build/
transitive dependencies remain unresolved from Stage 0.

Stage 1 is complete locally. Stop for review; Stage 2 requires a separate request.

## 2026-10-22 — Stage 0

Read README_START_HERE.md, PRODUCT.md, ARCHITECTURE.md, CALCULATION_RULES.md, and
ROADMAP.md in full. Preserved all five original documents at the repository root.
Initialized a local Git repository on `main`; no commit, remote, or push was made.

Added a Python `src/` package, the six-value result-status contract, packaging and
tool configuration, installation/status smoke tests, CI, ignore rules, README
design decisions, and contributor guidance. Reconciled inconsistent success
status names using CALCULATION_RULES.md section 7. Kept domain models, calculation
engine, browser code, persistence, official fixtures, and deployment out of scope.

### Environment and installation

The default system Python was 3.9.7. Used the available bundled Python 3.12.14 to
create the project-local `.venv` instead. In the portable command below,
`$python312` represents that runtime's executable path:

```powershell
& $python312 -m venv .venv
```

This first attempt created the environment but failed while bootstrapping pip
because the sandbox's temporary directory was not writable. Recovered with a
temporary directory inside the ignored environment:

```powershell
New-Item -ItemType Directory -Force -Path '.venv\tmp' | Out-Null
$env:TEMP = Join-Path (Get-Location) '.venv\tmp'
$env:TMP = $env:TEMP
.\.venv\Scripts\python.exe -m ensurepip --upgrade --default-pip
.\.venv\Scripts\python.exe -m pip install --no-cache-dir -e '.[dev]'
```

The first dependency installation failed due to sandbox network restrictions.
Retried with approved network access; installation succeeded. Pinned pytest
9.1.1, Hypothesis 6.170.5, and Ruff 0.17.1 in pyproject.toml, then successfully
reinstalled to refresh package metadata. No global Python installation was
modified. These temporary-directory overrides were local to the setup command.

### Verification actually run

| Command | Local outcome |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q` | 11 passed in 1.78 seconds |
| `.\.venv\Scripts\ruff.exe check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found |

The tests cover installed distribution metadata, the agreed six status names,
JSON roundtrips, and rejection of unagreed status names. They do not evaluate any
date arithmetic, immigration rule, browser integration, or legal entitlement.
The GitHub Actions workflow is configured but has not been run remotely.

### Remaining decisions and next stage

- Stage 1, only after a separate request: typed domain models, inclusive dates,
  validation, unique-day occupancy, and rolling-window arithmetic with the
  specified boundary tests. No Stage 1 work was performed here.
- Specify result precedence, detailed reason codes, finite supported calendar
  bounds, and computation limits as their implementation stages are reached.
- Build and transitive dependencies are not fully locked. The three primary
  development tools are pinned; runtime dependencies remain empty.
- Official references and examples have not been independently checked in this
  scaffolding stage; those verification and release gates remain open.
- Choose a license before public distribution. Nothing is published or deployed.

Stage 0's local test/lint gate is satisfied. The project is not a functioning
calculator and is not ready for travel use or public release.
