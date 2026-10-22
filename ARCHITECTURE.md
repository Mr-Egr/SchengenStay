# SchengenStay — Technical Architecture

> Sections 1-12 describe the planned V1 architecture, including features that
> are not implemented yet. For the current Stage 1 contract, API, and limits,
> see [section 13](#13-implemented-stage-1-engine). The browser interface,
> planning algorithms, and deployment remain planned work.

## 1. Architectural goals

Build a **genuinely Python-based** product whose date rules are unit-testable in CPython and reusable in the browser, without a paid backend or account system. Avoid introducing frameworks and infrastructure unrelated to the core problem.

**Chosen V1 design:** static frontend (HTML/CSS/vanilla JavaScript) + Pyodide running a pure-Python calculation engine locally + local browser persistence + static free hosting (e.g. GitHub Pages). The browser must make no network requests to calculate users' trip histories once static assets are loaded.

## 2. Component boundaries

```text
Browser / responsive UI (HTML, CSS, JavaScript)
  ├─ User controls: dashboard, history, calendar, planner
  ├─ Localized copy and accessibility
  ├─ Browser persistence (opt-in), JSON import/export
  └─ Python bridge (Pyodide, version pinned)
            │ validated JSON messages
            ▼
  Python package schengenstay
  ├─ models.py          typed inputs and outputs
  ├─ dates.py           date interval operations
  ├─ validation.py      ordering, overlap, unsupported status
  ├─ calculator.py      180-day usage and snapshot
  ├─ planner.py         itinerary compliance, horizon search
  ├─ explanations.py    typed reason codes and explanations
  └─ geography.py       explicit V1 support checks; no ad-hoc historic inference

No server database, no registration, no paid external services.
```

## 3. Python domain model

Suggested immutable `@dataclass(frozen=True)` objects:

- `ShortStay(id: str, entry: date, exit: date, note: str = '')`
- `OngoingStay(id: str, entry: date)` evaluated only with explicit `as_of: date`
- `PlannedStay(entry: date, exit: date)`
- `CheckRequest(check_date: date, stays: tuple[ShortStay, ...])`
- `CheckResult(status, used_days, remaining_arithmetic_days, window_start, window_end, warnings)`
- `PlanResult(status, first_violation_date, first_violation_count, scope_notes, ...)`
- `ValidationIssue(code, field, message_key, severity)`

Use enums / literals for statuses; avoid returning only booleans. Database entities are not required for V1.

## 4. Stable public Python API

```python
validate_history(stays: Sequence[ShortStay]) -> list[ValidationIssue]
usage_on(stays: Sequence[ShortStay], day: date) -> UsageResult
check_history(stays: Sequence[ShortStay], as_of: date) -> CheckResult
check_plan(stays: Sequence[ShortStay], plan: PlannedStay) -> PlanResult
max_continuous_stay(stays, arrival: date, horizon_days: int) -> MaxStayResult
find_earliest_entry(stays, length_days: int, search_start: date,
                    horizon_days: int) -> EntrySearchResult
```

**Avoid `allowed_to_travel()` naming**; product checks day-rule compliance, not legal admission.

## 5. Browser-to-Python bridge

- JS loads a **pinned** Pyodide version (no floating latest), then loads local Python package through packaged wheel/archive or supported bundled files.
- JS serializes validated request to a restricted schema; Python parses and revalidates everything, performs calculations, returns JSON with status codes and ISO dates.
- Handle Pyodide startup errors and computational errors with clear retry mechanism.
- Use worker where available to avoid blocking UI; test real worker support and asset paths in deployment.
- No executing generated/user-provided Python strings (`eval`, `exec`), and never interpolate raw field text into Python source. Prefer JSON request->Python entrypoint with fixed functions.
- Keep large/long calculations bounded to protect mobile devices.

## 6. Storage and privacy

Browser `localStorage` for small approved data only, optionally IndexedDB if needed. By default ask before persisting trip history; single-device state without server sync. JSON import/export with `schema_version`, max size (e.g. 100 KB) and maximum trip count (e.g. 500), strict schema and dates, no embedded scripts or HTML rendering of notes. CSP where feasible; no automatic analytics; no passport, birthdate or identifiers.

## 7. Localization

- `en` and `ru` translation dictionaries keyed by stable message IDs.
- Formula outputs are language neutral; Python returns `explanation_keys` and structured values; UI localizes messages.
- Use `Intl.DateTimeFormat` only for date presentation. Keep ISO date for data interchange; never parse localized display strings as canonical input.

## 8. User interface structure

```text
web/
  index.html
  styles/main.css
  scripts/app.js
  scripts/pyodide-bridge.js
  scripts/storage.js
  scripts/i18n.js
  scripts/calendar.js
  assets/
```

Mobile-first. Check screen has selected day, 180-day window, used / arithmetic remaining; plan screen shows first violation and interpretation; calendar details accessible by keyboard and descriptive text. Distinct unsupported-input banners.

## 9. Repo layout

```text
schengenstay/
  src/schengenstay/__init__.py
  src/schengenstay/models.py
  src/schengenstay/dates.py
  src/schengenstay/validation.py
  src/schengenstay/calculator.py
  src/schengenstay/planner.py
  src/schengenstay/explanations.py
  src/schengenstay/geography.py
  web/...
  tests/test_dates.py
  tests/test_validation.py
  tests/test_calculator.py
  tests/test_planner.py
  tests/test_properties.py
  tests/fixtures/official_examples.json
  docs/PRODUCT.md
  docs/ARCHITECTURE.md
  docs/CALCULATION_RULES.md
  docs/ROADMAP.md
  .github/workflows/ci.yml
  pyproject.toml
  README.md
  LICENSE
```

## 10. Tooling and reproducibility

- Python 3.12+, packaging via `pyproject.toml`; `pytest`, `hypothesis`, `ruff` in development dependencies.
- Configure `ruff check .`, `pytest -q` in CI.
- Static host such as GitHub Pages, exact build/deploy steps documented. Test base path for `/repository-name/` deploy.
- Aim for zero required monthly cost. CDN dependency for Pyodide should be transparent; offline is optional after initial cache.
- Unit and integration tests never rely on network or browser when testing Python math.
- Add smoke test for browser/Pyodide bridge, mobile layout and language toggle.

## 11. Threat model and operational risks

- Wrong travel calculation is high impact: visible scope warnings, authoritative test fixture comparison, regression tests and human review before publication.
- Unsupported legal grounds: return `OUT_OF_SCOPE`, not a misleading 90/180 green check.
- Duplicate / overlapping trips: refuse or warn; no silent contradictory history.
- Lost local data: optional export, explicit warning that browser storage can be cleared.
- Third-party script compromise: pin dependencies; restrict external content; minimize dependencies and remote calls.
- Slow initial Python load: indicator, deferred import and mobile performance verification.

## 12. Release gates

1. Pure Python engine + tests passes, including official manual examples.
2. Unsupported legal scenarios display warning, not travel permission.
3. UI works narrow mobile + desktop, keyboard accessible.
4. No user travel data is sent to backend or logs.
5. Deploy publicly; independently verify URL and rerun smoke tests.
6. Publish limitations and sources and remove unfinished features from marketing copy.


## 13. Implemented Stage 1 engine

### Design decisions and result vocabulary

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

### Current Python API and computation limits

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
