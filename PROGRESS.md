# Progress record

## 2026-10-22 — Stage 3 travel planner

Started from clean `main` and `origin/main` at `f53156b`. Read the product, rules,
architecture, roadmap, and progress documents and inspected Stage 1/2 source and
tests before changes. Implemented only the authorized pure-Python planner. The
user explicitly included scenario comparison, bringing its Python portion forward
from the original post-V1 scope. No UI, Pyodide, persistence, visa adjudication,
deployment, or new dependencies were added.

### Implementation and files

- Added `src/schengenstay/planner.py`: `max_continuous_stay()`,
  `find_earliest_entry()`, `compare_scenarios()`, frozen result models, strict
  bounds, explanation codes, and independently visible history/search outcomes.
- Updated `compliance.py` to extract its existing validated itinerary evaluator
  for reuse after the first `check_plan()` call. Earliest-entry search checks
  history once and reuses that evidence. Fixed-trip behavior is unchanged.
- Updated `explanations.py` with six planner reason codes and `__init__.py` with
  public function/result exports. The six top-level statuses remain unchanged.
- Added `tests/test_planner.py` and `tests/test_planner_properties.py`; extended
  `tests/test_official_examples.py` with maximum-duration comparisons and one
  explicitly derived earliest-entry regression. All original tests remain.
- Updated ARCHITECTURE.md section 15, CALCULATION_RULES.md, ROADMAP.md,
  CONTRIBUTING.md, the concise README, and this PROGRESS.md record.

Maximum search checks each proposed day until the first failure or bound. It
returns a proven maximum, a zero-day failed arrival, or a clearly labeled partial
compliant prefix. Earliest-entry search tests full trips in candidate order and
shares an inspection budget across candidates; it cannot skip an uncertain
candidate and claim a later one is earliest. No result within the horizon is
distinct from the arithmetic proof that over-90-day continuous countable trips
cannot fit this rule. Known historical violations remain visible independently
of future search results, including when a future search is incomplete.

Actual history, ongoing stays, and proposals stay separate. Ongoing history still
requires a confirmed actual exit before planning. Invalid, incomplete, unsupported,
and inspection-limited contexts propagate without an affirmative search verdict.
All bounds, aggregate precedence, first-failure evidence, prefix semantics,
algorithmic complexity, and executable examples are documented in section 15.
Every result remains informational arithmetic, never permission to enter or stay.

### Verification actually performed

Added behavior tests before implementing planner functions; the initial targeted
run failed with the expected missing-export collection error. After implementation,
116 targeted planner/compliance cases passed. Added independent exhaustive-oracle
properties, published-duration search cases, budget/calendar/input regressions,
and documentation. No test failures remain.

Final local checks on Python 3.12.14:

| Command/check | Result |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q --hypothesis-show-statistics` | 267 passed in 7.04 seconds, including all 197 existing cases |
| Property testing | 15 properties reached 200 passing examples each: 3,000 total, including 800 planner examples |
| `.\.venv\Scripts\ruff.exe check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found; dependencies unchanged |
| Local documentation links/anchors | 19 checked, all passed |
| Executable API examples in ARCHITECTURE.md | All 3 passed |
| `git diff --check` | No whitespace errors |
| Remote-history check before commit | `origin/main` still at `f53156bae02d5cca0fa87e729e913d9ca5377382` |

Maximum searches reproduce the four published Commission duration cases already
recorded in the offline fixture. The new earliest-entry case is derived from two
adjacent published arrival/duration cases; it is not labeled a published search
answer. The source was not newly retrieved and the live calculator was not used.
Broader official parity and live comparison remain pending. Hypothesis reports
discarded generated candidates separately; all 3,000 accepted examples passed.

Remaining limitations: user-declared countability/completeness cannot be verified;
finite horizons/inspection budgets can return incomplete searches; ongoing-stay
planning requires actual exit information; no legal or visa authorization is
assessed. Earlier license and full dependency-lock decisions remain open. Local
checks do not establish remote CI success. Stage 3 stops for review after its
single commit/push; no later-stage implementation is authorized by this record.

## 2026-10-22 — Stage 2 arithmetic compliance

Started from clean local `main` and `origin/main` at `25dd106`. Implemented Stage 2
only: history compliance and the roadmap's fixed prospective-itinerary check.
No Stage 3 date/duration searches, UI, Pyodide bridge, persistence, or deployment.
No dependencies were added and the six-status contract remains unchanged.

### Implemented behavior and files

- Added `src/schengenstay/compliance.py`: frozen CheckResult/PlanResult, structured
  preflight outcomes, full occupied-history scanning, first-violation evidence,
  separate check-date snapshot, fixed-itinerary checking, and inspection limits.
- Added `src/schengenstay/explanations.py`: declared calculation scopes, stable
  reasons, and scope/disclaimer text. No legal grounds are adjudicated or inferred.
- Updated `calculator.py` to share already-validated interval/snapshot helpers
  while preserving `usage_on()` behavior; updated `models.py` with a separate
  PlannedStay type, `validation.py` with request/plan issue codes, and package
  exports and contract documentation in `__init__.py` and `contracts.py`.
- Added `tests/test_compliance.py`, `tests/test_compliance_properties.py`,
  `tests/test_official_examples.py`, and `tests/fixtures/official_examples.json`.
  Existing Stage 0/1 tests were left intact.
- Updated ARCHITECTURE.md (section 14), CALCULATION_RULES.md (source verification),
  CONTRIBUTING.md, and the concise README. This PROGRESS.md entry records outcomes.

History checks scan every supplied occupied day through the explicit check date
in chronological order, stopping once the earliest violation is proven. Historical
violations survive later expiry from the final-date window. Valid recorded future
dates are clipped with a warning; malformed/overlapping records still invalidate
the input. Ongoing history requires an explicit cutoff and records the assumption.

Scope and history completeness are caller declarations: the default API assumes
complete, already-identified countable short stays. Unknown/incomplete data returns
INSUFFICIENT_DATA; requests for special legal contexts, visa validity, or historical
geography return OUT_OF_SCOPE. Malformed requests return INVALID_INPUT with field
issues. No result grants permission to enter or stay.

Fixed itineraries remain separate from actual history and are checked day by day.
The combined result cannot hide a historical violation behind a passing future
itinerary. Actual records must end by the explicit `as_of`, and ongoing records
need an actual exit before a future itinerary can be checked. No additional travel
between supplied history and the proposal is assumed, and that assumption is
reported. No input record is modified or persisted.

The existing 500-record limit remains. Compliance entry dates must permit a full
180-day window (at least `0001-06-29`). Each scan permits 1-10,000 occupied dates,
10,000 by default; incomplete scans return HORIZON_LIMIT, not WITHIN_RULE. Empty
calendar gaps do not consume this budget. See ARCHITECTURE.md for precise result
field semantics, status precedence, and the distinction from Stage 1 endpoints.

### Tests and official reference comparison

Wrote failing tests before implementation: two expected import/collection errors.
The first implementation run had 179 passes and one incorrect test expectation:
continuing a stay added a day as an old day expired, so the expected usage should
not have decreased. Replaced that fixture with a manually counted itinerary whose
first failure occurs on an interior day. Corrected two lint issues, then added
reference fixtures, remaining edge cases, and a scan-budget property.

The original Commission document/download URL returned HTTP 404 in this run.
Located an accessible [official manual](https://ec.europa.eu/assets/home/visa-calculator/docs/short_stay_schengen_calculator_user_manual_en.pdf),
section 6, printed pages 5-7, using 2024 dates. Six published arithmetic cases
match: two history snapshots and four fixed intervals based on published arrival
dates and durations. Five additional boundary regressions are explicitly labeled
as derived, not quoted official outcomes. Source URL, retrieval date, section,
pages, inputs, and the verification scope are preserved in the fixture. These
checks do not certify visa eligibility or implement a duration-search algorithm.
The live calculator was not exercised; broader official parity remains pending.

Final local checks on Python 3.12.14:

| Command/check | Result |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q --hypothesis-show-statistics` | 197 passed in 4.29 seconds |
| Property testing | 11 properties reached 200 passing examples each: 2,200 total, including 800 Stage 2 examples |
| `.\.venv\Scripts\ruff.exe check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found |
| Documentation links and anchors | Passed |
| Stage 1 and Stage 2 Python examples in ARCHITECTURE.md | Executed successfully |
| `git diff --check` | No whitespace errors |

Remaining limitations: caller-supplied scope/completeness cannot be independently
verified; live calculator comparison, broader release/reference checks, and future
browser validation remain open. Stage 0 licensing/build-lock decisions remain
unresolved. No remote CI success is claimed by these local results. Stop for
review after the single Stage 2 commit/push; further stages require a new request.

## 2026-10-22 — Project overview documentation

Rewrote README.md as a concise English project overview for recruiters and
contributors. It explains the problem, implemented engine features, planned
compliance/planning/browser work, stack, current status, quick setup, and legal
scope without implying that a web application or travel planner already exists.

Moved the complete design decisions, reserved result vocabulary, Python usage
example, API contract, date/input limits, error behavior, and algorithm notes into
ARCHITECTURE.md, section 13. Marked sections 1-12 as the planned V1 architecture.
Moved full platform setup, dependency/CI notes, file map, test scope, official
reference limitations, and licensing caveat into CONTRIBUTING.md. Updated its
cross-references. Application logic, tests, dependencies, and CI are unchanged.

Verification:

| Command/check | Result |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q` | 116 passed in 2.87 seconds |
| `.\.venv\Scripts\ruff.exe check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found |
| Documentation review | Local links/anchors resolve; detailed README sections preserved in their new locations |
| `git diff --check` | No whitespace errors |

## 2026-10-22 — Integrating the GitHub initial history

Configured `origin` as `https://github.com/Mr-Egr/SchengenStay` and inspected both
histories. Local `a50e7c6` contains the 22-file Stage 0/Stage 1 project; remote
`6bc87da` is the independent initial commit containing only README.md.

Merged with `git merge --allow-unrelated-histories --no-ff --no-commit origin/main`.
The only conflict was the expected README add/add conflict. Retained the complete
local README and inserted the remote's original description as planned project
scope. Both original commits remain parents/ancestors of the merge; neither was
rewritten. All original project files remain present. This log records the
integration checks; no calculation code, tests, dependencies, or CI were changed.

Checks after resolving the merge:

| Command | Result |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q` | 116 passed in 2.86 seconds |
| `.\.venv\Scripts\ruff.exe check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found |

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
