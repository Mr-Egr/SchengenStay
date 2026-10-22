# SchengenStay

Project description (planned scope):
Python-powered Schengen 90/180-day calculator and travel planning web application.

**Stage 1: pure Python date engine.** Inclusive interval operations, structured
history validation, and single-date rolling-window usage are implemented. There
is no compliance checker, travel planner, command-line interface, web interface,
or deployment yet.

The planned product evaluates the standard rolling 90/180 short-stay arithmetic
for user-identified countable Schengen short stays. It is not an official tool.

> Calculation checks only the standard rolling 90/180 short-stay rule; it is not
> permission to enter or stay.

## Setup and initial checks

Use Python **3.12 or newer**. Confirm `python --version` before creating the
environment; Python 3.9 is not supported. If `python` points to an older version,
use a Python 3.12+ executable or `py -3.12` for the environment creation command.

PowerShell, from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check .
```

No activation or PowerShell execution-policy change is required. On macOS/Linux:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
.venv/bin/python -m pip check
.venv/bin/python -m pytest -q
.venv/bin/ruff check .
```

With an activated environment, the checks are `python -m pytest -q` and
`ruff check .`. Tests import the installed package; install it before testing.
Initial installation needs access to the Python package index. Checks themselves
need no network, browser, accounts, API keys, or paid services.

## Dependencies

- Runtime: Python standard library only; no third-party runtime dependencies.
- Build: setuptools, used by pip to install the `src/` package.
- Development: pytest for unit tests, Ruff for linting, and Hypothesis for
  property-based arithmetic tests against an independent date-set oracle.

The three development tools are pinned to the versions verified locally in
`pyproject.toml`; transitive and build dependencies are not fully locked yet.
GitHub Actions runs the same
checks on Python 3.12 for pushes and pull requests. It does not deploy anything.

## Initial design decisions and requirement review

The supplied requirements remain in the repository root. Read
[PRODUCT.md](PRODUCT.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[CALCULATION_RULES.md](CALCULATION_RULES.md), and [ROADMAP.md](ROADMAP.md), starting
with [README_START_HERE.md](README_START_HERE.md).

1. **Stage boundary:** Stage 1 adds date models/helpers, validation, normalized
   intervals, and `usage_on()`. `check_history()`, compliance verdicts,
   first-violation reporting, planning, and all browser work remain deferred.
2. **Canonical status vocabulary:** `CALCULATION_RULES.md` section 7 is the public
   result contract. PRODUCT.md also uses `VALID_FOR_RULE` and
   `WITHIN_90_180_RULE`; these are not additional API statuses. The supported
   success code is `WITHIN_RULE`. No status means travel is authorized.
3. **Bounded searches:** the roadmap/rules mention `NOT_FOUND_WITHIN_HORIZON`.
   Treat that as a future reason for `HORIZON_LIMIT`, not a seventh top-level
   status. No search behavior is implemented.
4. **Scope:** inputs must already represent countable short stays. Country
   labels are descriptive metadata only. Historical membership inference,
   residence permits, D visas, pending applications, national extensions, bilateral
   arrangements, and visa-sticker adjudication are unsupported. Ambiguous legal
   grounds must not yield an affirmative arithmetic verdict.
5. **Arithmetic:** use `datetime.date`, inclusive entry/exit dates, and
   `[day - 179 days, day]`. Snapshot remaining days are not a promise of a future
   continuous stay. Flag overlaps while ensuring low-level arithmetic never
   double-counts dates. Checking every proposed day and reporting past violations
   separately belong to Stage 2.
6. **Architecture:** calculations use pure Python with no network or
   clock-dependent behavior. Later stages will add static HTML/CSS/vanilla JS and
   pinned Pyodide. No backend, database, accounts, telemetry, or paid APIs.
7. **Data and privacy:** later persistence will require informed choice and stay
   on the device; planned travel remains separate from actual travel. JSON import
   limits and schema validation belong to later implementation stages.

| Status | Intended meaning once calculation features exist |
| --- | --- |
| `WITHIN_RULE` | Supported itinerary satisfies the arithmetic being evaluated |
| `VIOLATION` | Evaluated rolling-day count exceeds the rule |
| `INVALID_INPUT` | Malformed or inconsistent input |
| `INSUFFICIENT_DATA` | Required information is missing |
| `OUT_OF_SCOPE` | Requested legal context or scenario is unsupported |
| `HORIZON_LIMIT` | A bounded computation reached its search limit |

The enum reserves compliance-result names for Stage 2. Stage 1 `UsageResult`
contains numbers, dates, scope notes, and any ongoing-stay assumption, but no
compliance status. Future status precedence and planning limits remain undecided.

## Stage 1 Python API

```python
from datetime import date
from schengenstay import ShortStay, usage_on, validate_history

stays = [ShortStay("trip-1", date(2024, 2, 28), date(2024, 3, 1))]
assert validate_history(stays) == []
result = usage_on(stays, date(2024, 3, 1))
assert result.used_days == 3
assert result.remaining_arithmetic_days == 87
```

- `ShortStay(id, entry, exit, note="")` and `OngoingStay(id, entry)` are frozen
  records. Construction preserves supplied fields; `validate_history()` reports
  malformed dates, IDs, notes, reversed ranges, duplicate IDs, and overlaps.
- `validate_history(stays, *, as_of=None)` returns `ValidationIssue` objects with
  a stable `IssueCode`, field path, translation key, severity, and optional related
  field. It accepts at most **500 records** in a sequence. Unsorted records are
  valid. Shared exit/entry dates overlap because both boundaries count; successive
  calendar-day records are valid. For each conflicting record it reports one
  earlier overlapping record, rather than enumerating every overlapping pair.
- `usage_on(stays, day)` validates the entire history, including future records,
  and raises `HistoryValidationError` with `.issues` on invalid input. It never
  returns a partial count for invalid history. Valid recorded dates after `day`
  do not contribute. Remaining arithmetic is `max(0, 90 - used_days)`.
- Ongoing records require an explicit `as_of` for validation. In `usage_on`, the
  required `day` supplies that date. Presence is assumed through that date and the
  IDs are reported in `result.assumed_ongoing_ids`; the record gets no invented
  exit date. An ongoing entry after the check date is rejected.
- `schengenstay.dates` provides strict ASCII `parse_iso_date()`, immutable
  `DateInterval`, `inclusive_length()`, `rolling_window()`,
  `normalize_intervals()`, and `count_occupied_days()`. Low-level normalization
  merges overlapping/adjacent intervals and deduplicates coverage; it must not be
  used to silently resolve invalid user history. Helpers accept finite sequences
  or iterables of validated intervals; the 500-record limit applies to history APIs.
- Date endpoints span `0001-01-01` through `9999-12-31`. Check dates start at
  `0001-06-29`, the earliest date with a full representable 180-day window. Earlier
  dates raise `ValueError` instead of truncating the window. These are computational
  bounds, not a claim that historical legal rules are supported.
- Strings must be explicitly parsed. `datetime` timestamps and other date
  subclasses are rejected; no timezone conversion or current clock is used.
  Invalid helper/check-date types raise `TypeError`; invalid date text, reversed
  intervals, and unrepresentable windows raise `ValueError`.

Counting clips intervals to the window, sorts and merges coverage, and sums
inclusive lengths: O(n log n) time and O(n) memory for n intervals. It never
expands a multi-year stay into millions of dates. Hypothesis tests compare this
with a separate enumerating oracle, including overlaps, input permutations,
normalization, and calendar boundaries.

## Files and verification scope

```text
src/schengenstay/__init__.py    public package import
src/schengenstay/contracts.py  six agreed result statuses
src/schengenstay/models.py     completed/ongoing records and usage snapshots
src/schengenstay/dates.py      parsing, inclusive intervals, unique coverage
src/schengenstay/validation.py structured validation and overlap detection
src/schengenstay/calculator.py validated rolling 180-day usage
tests/test_contracts.py        installation and JSON/status contract checks
tests/test_dates.py            parsing and calendar boundary tests
tests/test_validation.py       malformed, duplicate, overlapping history tests
tests/test_calculator.py       hand-counted snapshot and expiry cases
tests/test_properties.py       independent oracle and invariants
pyproject.toml                packaging, dependencies, pytest and Ruff settings
.github/workflows/ci.yml       automated lint/test checks
.gitignore                    environments, caches and generated files
CONTRIBUTING.md                contribution and stage-boundary guidance
PROGRESS.md                    commands, results and remaining work
```

The original five requirements documents are preserved. Unit tests cover inclusive
boundaries, empty/one-day histories, leap/century years, the 90th/91st day, gradual
expiry, future dates, duplicate coverage, ongoing assumptions, and date extremes.
Seven deterministic property tests each run 200 generated examples. The fixtures
are synthetic/manual arithmetic cases, not official compliance examples.

The [European Commission calculator page](https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en)
was reviewed on 2026-10-22 for the rolling-day principle. Its linked manual URL
returned HTTP 429 during this work. Official example matching and live calculator
comparison remain Stage 2/release work, as do full scope handling, browser tests,
and release gates. No license has been selected; choose one before public
distribution rather than assuming licensing terms on the owner's behalf.

See [CONTRIBUTING.md](CONTRIBUTING.md) for workflow and [PROGRESS.md](PROGRESS.md)
for the local verification record. Stage 2 is the proposed next stage and requires
a separate request.
