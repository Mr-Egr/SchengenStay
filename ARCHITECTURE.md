# SchengenStay — Technical Architecture

> Sections 1-12 describe the planned V1 architecture, including features that
> are not implemented yet. The implemented date engine is documented in
> [section 13](#13-implemented-stage-1-engine), and the Stage 2 compliance contract
> in [section 14](#14-stage-2-compliance-contract). Stage 3 planning is documented
> in [section 15](#15-stage-3-travel-planner). The frontend preview is documented in
> [section 16](#16-stage-4-frontend-preview). Implemented Python/browser integration
> and opt-in persistence are in [section 17](#17-stage-5-pythonbrowser-integration).
> Deployment remains deferred. Earlier stage sections retain their historical scope.

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
   intervals, and `usage_on()`. Stage 2 adds `check_history()` and fixed-itinerary
   `check_plan()` with first-violation reporting (section 14). Stage 3 adds bounded
   searches and independent scenario comparison (section 15). Stage 4 supplies a
   frontend preview (section 16); Stage 5 connects real Python calculations (section 17).
2. **Canonical status vocabulary:** `CALCULATION_RULES.md` section 7 is the public
   result contract. PRODUCT.md also uses `VALID_FOR_RULE` and
   `WITHIN_90_180_RULE`; these are not additional API statuses. The supported
   success code is `WITHIN_RULE`. No status means travel is authorized.
3. **Bounded searches:** the roadmap/rules mention `NOT_FOUND_WITHIN_HORIZON`.
   This is a reason for `HORIZON_LIMIT`, not a seventh top-level status.
4. **Scope:** inputs must already represent countable short stays. Country
   labels are descriptive metadata only. Historical membership inference,
   residence permits, D visas, pending applications, national extensions, bilateral
   arrangements, and visa-sticker adjudication are unsupported. Ambiguous legal
   grounds must not yield an affirmative arithmetic verdict.
5. **Arithmetic:** use `datetime.date`, inclusive entry/exit dates, and
   `[day - 179 days, day]`. Snapshot remaining days are not a promise of a future
   continuous stay. Flag overlaps while ensuring low-level arithmetic never
   double-counts dates. Checking every proposed day and reporting past violations
   separately are implemented in Stage 2.
6. **Architecture:** calculations use pure Python with no network or
   clock-dependent behavior. Later stages will add static HTML/CSS/vanilla JS and
   pinned Pyodide. No backend, database, accounts, telemetry, or paid APIs.
7. **Data and privacy:** later persistence will require informed choice and stay
   on the device; planned travel remains separate from actual travel. JSON import
   limits and schema validation belong to later implementation stages.

| Status | Arithmetic result meaning |
| --- | --- |
| `WITHIN_RULE` | Supported itinerary satisfies the arithmetic being evaluated |
| `VIOLATION` | Evaluated rolling-day count exceeds the rule |
| `INVALID_INPUT` | Malformed or inconsistent input |
| `INSUFFICIENT_DATA` | Required information is missing |
| `OUT_OF_SCOPE` | Requested legal context or scenario is unsupported |
| `HORIZON_LIMIT` | A bounded computation reached its search limit |

The enum is used by Stage 2 compliance results. Stage 1 `UsageResult`
contains numbers, dates, scope notes, and any ongoing-stay assumption, but no
compliance status. Stage 2 precedence and inspection limits are specified below;
Stage 3 search limits are specified in section 15.

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

## 14. Stage 2 compliance contract

`compliance.py` reuses the Stage 1 validators, interval normalization, rolling
windows, and usage calculation. `explanations.py` defines scope and reason enums.
No visa, residence-permit, nationality, or country-membership decision is made.
The six `ResultStatus` values are unchanged.

### APIs and scope declarations

```python
from datetime import date
from schengenstay import (
    CalculationScope, PlannedStay, ResultStatus, ShortStay,
    check_history, check_plan,
)

history = [ShortStay("actual-1", date(2024, 1, 1), date(2024, 3, 31))]
result = check_history(history, as_of=date(2024, 12, 31))
assert result.status is ResultStatus.VIOLATION
assert result.first_violation_date == date(2024, 3, 31)
assert result.used_days == result.violation_count == 91
assert result.snapshot.used_days == 0  # A later empty window cannot erase the violation.

proposed = PlannedStay(date(2025, 1, 1), date(2025, 1, 2))
combined = check_plan(history, proposed, as_of=date(2024, 12, 31))
assert combined.history_result.status is ResultStatus.VIOLATION
assert combined.itinerary_result.status is ResultStatus.WITHIN_RULE
assert combined.status is ResultStatus.VIOLATION

unknown = check_history([], date(2024, 12, 31), scope=CalculationScope.UNKNOWN)
assert unknown.status is ResultStatus.INSUFFICIENT_DATA
```

Both APIs accept `scope`, `history_complete`, and `max_inspected_days` keyword
arguments. `check_plan()` also requires an explicit `as_of` for actual history;
it never substitutes the proposed arrival or the current date for that cutoff.

- The default `scope=CalculationScope.COUNTABLE_SHORT_STAYS` and
  `history_complete=True` declare that the caller has supplied complete,
  already-identified countable short-stay history. They are API assumptions, not
  facts the program can independently establish. An empty sequence means no
  countable travel is reported; `None` means the history is missing.
- Use `scope=UNKNOWN` (or `None`) when countability is unknown, and
  `history_complete=False` (or `None`) when history is incomplete. No affirmative
  result is computed in these cases. Strings are not implicitly converted to enums.
- `SPECIAL_LEGAL_CONTEXT` covers requests involving residence permits, D visas,
  pending applications, extensions, bilateral arrangements, or other special
  grounds. `VISA_VALIDITY` and `HISTORICAL_GEOGRAPHY` identify other unsupported
  requests. All return `OUT_OF_SCOPE`; none attempts to infer which days to omit.
- Notes and nationality are never used to infer scope. A future caller/UI must
  obtain the scope declaration instead of treating arbitrary legal records as
  countable short stays.

### What is inspected

`check_history()` validates the entire supplied history first, then clips coverage
to `as_of`. It examines occupied dates chronologically from the earliest supplied
entry, including trips outside the final 180-day window. It skips unoccupied gaps
because no new occupied day can increase usage during them. Each inspected day
uses its own inclusive `[day - 179, day]` window. Scanning stops once the earliest
violation is proven; subsequent days cannot change that first violation.

Valid recorded dates after `as_of` are excluded and reported with
`FUTURE_DATES_IGNORED`. Malformed/overlapping future records still invalidate the
request. An `OngoingStay` assumes presence through the explicit `as_of`, retains
no fabricated exit, and produces `ONGOING_ASSUMED_THROUGH_CHECK_DATE` plus IDs in
the snapshot's `assumed_ongoing_ids`. PlannedStay objects cannot enter history.

`check_plan()` tests only a fixed proposed interval, not a search for dates or
duration. Actual completed records must all end by `as_of`; the proposed entry
must be later than `as_of`. Ongoing records return `INSUFFICIENT_DATA` with
`ONGOING_EXIT_REQUIRED` until their actual exit is known. This prevents silently
inventing an exit and assuming a gap before planned travel. No additional travel
between supplied actual history and the proposal is assumed; this is reported in
the itinerary's warnings. Neither the input history nor the proposal is mutated.

History is checked separately first. A historical violation remains visible even
if the later itinerary passes. When history cannot be evaluated (invalid, missing,
unsupported, or inspection-limited), no itinerary success is produced.

### Results and reasons

`CheckResult` and `PlanResult` are frozen dataclasses exported at package level.

- `CheckResult.snapshot` is usage on the requested date; `first_violation` is a
  separate usage snapshot on the earliest violating date. Convenience properties
  `used_days`, `window_start`, `window_end`, and `remaining_arithmetic_days` refer
  to the first violation when present, otherwise the selected-date snapshot.
  `first_violation_date` and `violation_count` are absent when no failure was found.
- `inspected_dates` is a count of occupied dates actually inspected, not a list or
  the elapsed calendar span. `inspected_through` is the last inspected date.
- `reason_codes` and `warnings` use `ReasonCode`; `human_explanation_keys` maps
  them to stable `compliance.<lowercase_code>` keys. `issues` retains structured
  field-level `ValidationIssue` objects. All results retain the scope disclaimer.
- Invalid, unsupported, and insufficient-data history results contain no numerical
  snapshot or violation evidence. A budget-limited result may expose its exact
  final-date snapshot while explicitly declining an all-history passing verdict.
- `PlanResult.history_result` and `itinerary_result` expose each assessment. Its
  top-level status is `VIOLATION` if either has a proven violation, otherwise the
  itinerary status. Its reasons distinguish `HISTORICAL_VIOLATION` from
  `ITINERARY_VIOLATION`; no plan is promoted into actual history.

History preflight precedence is invalid request/history, unsupported scope, missing
information, then arithmetic. Plan shape/date errors are also checked before any
arithmetic, and plan/history chronology is checked after the shared preflight.

| Status | Representative reasons / interpretation |
| --- | --- |
| `WITHIN_RULE` | `NO_VIOLATION_FOUND`: all required occupied dates were inspected within the supplied scope |
| `VIOLATION` | `ROLLING_LIMIT_EXCEEDED`: first usage above 90, with its date and window |
| `INVALID_INPUT` | `INVALID_REQUEST` or `INVALID_HISTORY`: malformed types/dates/options, overlaps, duplicate IDs, or contradictory plan/history dates |
| `INSUFFICIENT_DATA` | `CHECK_DATE_REQUIRED`, `HISTORY_REQUIRED`, `HISTORY_INCOMPLETE`, `COUNTABILITY_UNKNOWN`, `PLAN_REQUIRED`, or `ONGOING_EXIT_REQUIRED` |
| `OUT_OF_SCOPE` | `UNSUPPORTED_SCOPE` or `HISTORY_DATE_RANGE_UNSUPPORTED` |
| `HORIZON_LIMIT` | `INSPECTION_LIMIT_REACHED`: incomplete scan; never equivalent to `WITHIN_RULE` |

### Bounds and verification

The existing 500-record history limit remains. History compliance requires all
supplied entry dates to be at least `0001-06-29`, so every inspected day has a full
representable window. Earlier valid calendar entries yield `OUT_OF_SCOPE`, whereas
an invalid check-date range yields `INVALID_INPUT`. Stage 1 snapshot arithmetic
retains its wider endpoint support. These are computational bounds only.

Each history/itinerary scan permits 1 through 10,000 occupied days (10,000 by
default). A supplied budget must be an integer, not a boolean. Exact completion
at the limit can pass; a proven violation at the limit takes precedence over
exhaustion. Long empty gaps do not consume this budget. Iteration uses ordinals to
include `date.max` safely. History and fixed-itinerary scans have separate budgets.
Worst-case work is O(k n log n), using existing interval counts for k inspected
days and n records, with O(n) working storage; a definite violation stops early.

Tests compare the daily scan and budget outcomes against independent occupied-date
sets, plus calendar boundaries, malformed inputs, history/order invariance,
historical violations after expiry, and separate itinerary results. Published
Commission arithmetic examples and their exact source/version are recorded in
`tests/fixtures/official_examples.json` and tested offline. Derived next-day
boundaries are labeled separately. Live calculator comparison, broader official
coverage, legal-source review for release, and browser work remain outstanding.

## 15. Stage 3 travel planner

`planner.py` builds on the existing fixed-trip `check_plan()` API. All searches
validate the first proposal through that API. Earliest-entry search then reuses
its validated immutable intervals and historical result with the same internal
itinerary evaluator; it does not duplicate day arithmetic or rescan history for
every candidate. Scenario comparison calls `check_plan()` for each independent
alternative. No proposed trip is appended to actual history, saved, or transmitted.

The user's Stage 3 scope explicitly includes pure-Python scenario comparison,
bringing that portion of the original post-V1 requirement forward. A comparison
view, saved variants, and all browser/persistence work remain future stages.

### Public signatures

```python
max_continuous_stay(stays, arrival: date, horizon_days: int, *,
                    as_of=None, scope=CalculationScope.COUNTABLE_SHORT_STAYS,
                    history_complete=True, max_inspected_days=10_000) -> MaxStayResult

find_earliest_entry(stays, length_days: int, search_start: date, horizon_days: int, *,
                    as_of=None, scope=CalculationScope.COUNTABLE_SHORT_STAYS,
                    history_complete=True, max_inspected_days=10_000) -> EntrySearchResult

compare_scenarios(stays, scenarios: Sequence[PlannedStay], *,
                  as_of=None, scope=CalculationScope.COUNTABLE_SHORT_STAYS,
                  history_complete=True, max_inspected_days=10_000) -> ComparisonResult
```

These functions and the result classes (including `ScenarioResult`) are exported
from `schengenstay`. `stays` is `Sequence[HistoryStay] | None`; dates must be exact
`datetime.date` objects. Fixed-trip evaluation remains
`check_plan(stays, plan: PlannedStay | None, *, as_of=None, scope=...,`
`history_complete=True, max_inspected_days=10_000) -> PlanResult`.

An explicit `as_of` is required in practice: omitting it returns
`INSUFFICIENT_DATA`. All completed history must end by that cutoff; every proposed
entry/search start must follow it. An occupied date is therefore rejected as
inconsistent chronology, never counted a second time. Ongoing history returns
`ONGOING_EXIT_REQUIRED`; the caller must supply a confirmed actual exit before
planning. Scope/completeness declarations and their defaults are unchanged from
section 14. Invalid, incomplete, unsupported, or inspection-limited history blocks
planning. No intermediate travel between history and a proposal is assumed; each
evaluated itinerary retains `NO_ADDITIONAL_TRAVEL_ASSUMED` in its warnings.

### Search result interpretation

The six-status vocabulary is unchanged. Frozen search results expose `status`,
`planning_status`, `reason_codes`, `history_result`, `evaluation`, `issues`,
`scope_notes`, and `human_explanation_keys` (`planner.<lowercase_code>`).
`evaluation` is a `PlanResult`, preserving daily evidence, used days, window,
warnings, and the separate historical result.

- `planning_status` describes only the search. `status` additionally preserves a
  known historical violation as `VIOLATION`, even when a later maximum or entry
  is found. `HISTORICAL_VIOLATION` remains in the reasons. If a historical
  violation and an incomplete search coexist, the aggregate is `VIOLATION` and
  `planning_status` is `HORIZON_LIMIT`; neither fact is hidden.
- `MaxStayResult` supplies `arrival`, `search_horizon_end`, `consecutive_days`,
  `latest_compliant_exit`, `first_violation_date`, and `maximum_proven`.
  `None` days means no planning scan; zero means the first proposed day fails.
  A positive prefix followed by an inspected violation proves its maximum and
  has planning status `WITHIN_RULE` with `MAXIMUM_STAY_FOUND`. The probe in
  `evaluation` deliberately includes the failing day, so its itinerary status is
  `VIOLATION`; its snapshot describes the probe's end, not the prefix's exit.
  A failing arrival instead returns `VIOLATION` / `ENTRY_DATE_EXCEEDS_LIMIT`.
- A maximum search that stops without a violation returns `HORIZON_LIMIT` and
  `maximum_proven=False`. Its length/exit describe only the inspected compliant
  prefix. `SEARCH_HORIZON_REACHED` distinguishes the requested date bound from
  `INSPECTION_LIMIT_REACHED`. Even 90 checked days remain horizon-limited until
  the first failing day has actually been inspected.
- `EntrySearchResult` supplies `length_days`, `search_start`, `search_horizon_end`,
  `entry`, `exit`, `candidates_checked`, `inspected_plan_days`, and
  `arithmetic_impossible`. Dates are returned only after the **entire** candidate
  passes, with planning status `WITHIN_RULE` / `EARLIEST_ENTRY_FOUND`.
  `evaluation` describes that candidate, or the last attempted one if no match.
- Exhausting all candidate dates yields `HORIZON_LIMIT` /
  `NOT_FOUND_WITHIN_HORIZON`; it does not mean no later date can work.
  Exhausting inspection work yields `INSPECTION_LIMIT_REACHED`; the engine stops
  rather than skipping an uncertain earlier candidate and calling a later one
  earliest. A complete last candidate takes precedence over budget exhaustion.
- A structurally valid requested continuous length over 90 days can never fit
  this arithmetic: its first 91 days alone exceed the count in a 180-day window.
  After valid context/history and a failing candidate are established, the search
  returns `VIOLATION` / `TRIP_LENGTH_EXCEEDS_LIMIT`, `arithmetic_impossible=True`.
  It does not search later dates. Blocked context/history or a budget-limited
  first candidate still propagates its blocked/limited outcome. This is only a
  statement about continuous countable days under this rule, not legal eligibility.

`ComparisonResult.scenarios` is an ordered tuple of `ScenarioResult(index, plan,
result)`. Each result is a complete, independent `PlanResult`; invalid items do
not hide the other alternatives. An absent or wrong-type proposal is represented
by `plan=None` and retains its index and structured check result. A malformed
scenario container has top-level issues; item issues stay in the item's result.
Aggregate precedence is `INVALID_INPUT`, `OUT_OF_SCOPE`, `INSUFFICIENT_DATA`,
`VIOLATION`, `HORIZON_LIMIT`, then `WITHIN_RULE`. Display individual outcomes
alongside this summary: it does not replace their distinct explanations.

### Bounds and algorithmic cost

- At most 500 actual history records, with existing date/scope validation.
- `horizon_days` and `length_days` must be integers from 1 to 10,000; booleans,
  strings, zero, negatives, and larger values produce structured `INVALID_INPUT`.
  Over-90 lengths within that input cap are arithmetic impossibilities, not
  malformed requests. Search constants live in `schengenstay.planner`.
- A maximum horizon includes arrival: `[arrival, arrival + horizon_days - 1]`.
  An entry-search horizon includes the first and last **entry** candidates:
  `[search_start, search_start + horizon_days - 1]`. Departures may fall beyond
  that horizon. All requested candidate departures must fit `date.max`; the
  engine rejects overflowing bounds rather than silently shortening them.
- `max_inspected_days` remains an exact integer from 1 to 10,000. Maximum search
  has separate history and probe budgets. Earliest-entry search checks history
  once with that budget, then shares a second budget across all candidate days.
  At least one inspection is used per attempted candidate. Passing arrival
  alone never certifies a longer trip. Ordinal iteration avoids date overflow.
- Scenario comparison accepts a sequence of 1-100 alternatives, each with its
  own fixed-trip history and itinerary budgets. Empty lists, generators, and
  malformed containers return `INVALID_INPUT`.

The reference search proceeds chronologically and uses the existing interval
counter on every inspected proposed day, allowing old days to expire naturally.
There is no `90 - used_on_arrival` shortcut, monotonicity assumption about arrival
dates, or unbounded loop. For n records, k history inspections, h entry candidates,
l trip days, and b the plan inspection budget, maximum search costs
O((k + min(horizon, b, 91)) n log n). Earliest search costs
O((k + min(h * min(l, 91), b)) n log n), plus a snapshot per candidate of the same
order; it stores O(n) working data. Comparison of s scenarios costs
O(s (k + min(l, b, 91)) n log n), with O(n + s) storage. Treat n as at least 2 in
these bounds for empty/single-record cases. Comparison intentionally favors the
public fixed-trip reference path over caching; repeated past scans are bounded.

Four new deterministic properties compare maximum length, earliest-entry
minimality, inspection budgets, and independent scenarios against a separate
occupied-date-set oracle. Existing Stage 1/2 tests remain. Maximum searches also
match the four published duration cases in the existing Commission fixture;
the adjacent-date earliest-entry assertion is explicitly labeled derived.
No new live-calculator verification or broad official parity is claimed.

### Executable examples

```python
from datetime import date
from schengenstay import (
    PlannedStay, ResultStatus, ShortStay, compare_scenarios,
    find_earliest_entry, max_continuous_stay,
)

maximum = max_continuous_stay([], date(2024, 1, 1), 91, as_of=date(2023, 12, 31))
assert maximum.status is ResultStatus.WITHIN_RULE
assert maximum.consecutive_days == 90
assert maximum.latest_compliant_exit == date(2024, 3, 30)
assert maximum.first_violation_date == date(2024, 3, 31)
assert maximum.maximum_proven

history = [ShortStay("actual", date(2024, 1, 1), date(2024, 3, 30))]
earliest = find_earliest_entry(history, 90, date(2024, 6, 28), 2,
                              as_of=date(2024, 6, 27))
assert earliest.entry == date(2024, 6, 29)
assert earliest.exit == date(2024, 9, 26)

comparison = compare_scenarios(history, [
    PlannedStay(date(2024, 6, 28), date(2024, 6, 28)),
    PlannedStay(date(2024, 6, 29), date(2024, 9, 26)),
], as_of=date(2024, 6, 27))
assert [item.result.status for item in comparison.scenarios] == [
    ResultStatus.VIOLATION, ResultStatus.WITHIN_RULE,
]
assert len(history) == 1  # Hypothetical travel was not added to actual history.
```

All outputs remain informational arithmetic. No result grants permission to enter
or stay. No visa/nationality/residence adjudication, browser, Pyodide integration,
persistence, or deployment is implemented in Stage 3.

## 16. Stage 4 frontend preview

The user's 2026-10-23 instruction supersedes the original stage order: Stage 4 is
frontend only; Stage 5 will connect Python through Pyodide and add optional local
persistence. The existing Python package, domain contracts, and tests are unchanged.
See [the frontend guide](docs/FRONTEND.md) for setup, module/file details, actual
screenshots, checks, and the precise integration checklist.

The browser uses HTML5, modern CSS, and vanilla JavaScript ES modules. All fonts
are system fonts and all assets are local original SVGs. There is no framework,
bundler, runtime dependency, API, server application, or paid service. A loopback
static HTTP server is needed only to preview ES modules locally.

`app.js` composes seven hash-routed views with reusable components, a temporary
store, localized strings, and calendar presentation helpers. The store keeps
immutable completed-trip and hypothetical-scenario records in separate arrays;
editing a scenario cannot alter actual history. Generated IDs are session-local.
Labels/notes are displayed as text nodes, never interpolated HTML or code. No
trip information is written to URLs, browser storage, cookies, logs, or a server.
Reload clears all data and preferences; the UI explains this visibly.

The overview displays only the actual number of entered records. Day-used and
day-remaining cards show dashes. The calculator accepts a selected date but its
calculation control is explicitly unavailable. Fixed-date, maximum-stay, and
earliest-entry forms retain independent requests with “not evaluated” panels;
they do not generate exit dates or verdicts. Calendar colors and shapes mark
entered historical/fixed-tentative intervals only. Requests for a search do not
imply calendar occupancy. JavaScript date work is restricted to input feedback,
month navigation, date formatting, and marking user-entered intervals.

Browser presentation states (`empty`, `unavailable`, `loading`, `error`) are not
new Python domain statuses. Loading/error calculation components are reserved
and tested for Stage 5, without fake runtime delays or result fixtures. A real
module-import failure instead displays an honest startup error and reload action.
There is no transport adapter returning pretend `WITHIN_RULE` results.

Accessibility includes semantic landmarks/headings, skip navigation, current-page
indicators, named fields and errors, live announcements, focus restoration,
keyboard-contained native dialogs, Escape cancellation, arrow-key calendar date
navigation, non-color markers, visible focus, and reduced-motion styling. English
and Russian dictionaries have matching keys. `Intl.DateTimeFormat` formats ISO
dates in UTC to preserve their day; browser-native input formatting follows the
OS/browser. Light/dark and language selections are memory-only preferences.

Node's built-in unit tests check data/state/date/localization boundaries, import
syntax, local assets, and absence of browser network/storage or duplicate engine
calls. A separate optional Playwright suite exercises the actual interface and
responsive/accessibility basics. It starts its own temporary loopback static
server; it is development tooling, not an application backend. CI adds Node 22
unit/static checks and an offline Markdown-link/API-example check. No browser CI
or deployment success is implied by passing local checks.

Stage 5 must introduce explicit user declarations for countability/completeness,
an explicit `as_of`, Python validation at the bridge boundary, all six domain
statuses, independent past/future results, reason/window evidence, and bounded
search outcomes. UI-only labels remain metadata; notes must never determine
legal scope. Persistent storage requires informed consent and its own versioned
schema/validation. Source notes and pending official/live-calculator comparisons
remain unchanged. The frontend is informational and cannot grant travel permission.


## 17. Stage 5 Python/browser integration

The static UI now executes the **same Python source package** through pinned
Pyodide 314.0.7 in a module Web Worker. Stage 1–3 algorithms and public signatures
are unchanged. No calculation rules were ported to JavaScript. No backend,
account, database, Pyodide package installation, or deployment was introduced.
See [the browser guide](docs/FRONTEND.md) for launch, packaging, lifecycle,
privacy, troubleshooting, screenshots and test commands.

### Version 1 boundary

`schengenstay.browser.handle_json(payload: str) -> str` accepts a maximum
512,000 UTF-8 bytes and returns `{ "schema_version": 1, "result": ... }`.
The request has `schema_version: 1` and one allowlisted `method`:
`usage_on`, `check_history`, `check_plan`, `max_continuous_stay`,
`find_earliest_entry`, or `compare_scenarios`.

Common fields:

| Field | Wire representation / semantics |
| --- | --- |
| `stays` | List of completed `{kind: "completed", id, entry, exit, note?}` or ongoing `{kind: "ongoing", id, entry}` records; `null` remains missing history |
| `as_of` | Strict ASCII `YYYY-MM-DD`; an explicit date is required for meaningful results |
| `scope` | One `CalculationScope` string; missing/unknown remains unconfirmed |
| `history_complete` | Boolean; missing defaults to false, never to the domain API's affirmative default |
| `ongoing_confirmed` | Boolean; explicit continuous presence through `as_of`, false by default |
| `max_inspected_days` | Integer 1–10,000, default 10,000; domain validator rejects booleans and malformed values |

Method-specific fields mirror the Python signatures: `plan: {entry, exit}`;
`arrival` and `horizon_days`; `length_days`, `search_start` and `horizon_days`;
or `scenarios: [{entry, exit}, ...]`. Unknown top-level keys, versions or method
names produce structured `INVALID_INPUT`. Malformed JSON/oversize requests also
produce `INVALID_INPUT`; unexpected execution failures remain transport failures
and cannot become arithmetic success. No user-provided Python source is accepted.

The adapter converts dates with `parse_iso_date`, scope strings to
`CalculationScope`, and records to existing frozen models. Malformed fields are
preserved for the domain validators, including duplicate IDs and overlaps.
Explicit ongoing confirmation is an additional browser input prerequisite:
missing confirmation yields `INSUFFICIENT_DATA` with the bridge-only explanation
`ONGOING_CONFIRMATION_REQUIRED`. Invalid/unsupported context retains precedence.
Planning still delegates to the existing `ONGOING_EXIT_REQUIRED` behavior.

`serialize()` converts dataclasses recursively, enums to their values, dates to
ISO strings and tuples to JSON arrays. It includes all fields plus documented
properties: `human_explanation_keys`, `first_violation_date`, `violation_count`,
`used_days`, `remaining_arithmetic_days`, `window_start`, `window_end` when the
result type provides them. Validation issue fields/codes, nested history/itinerary
results, warnings, scope notes, inspection counts and search proof flags survive.

The `usage_on` bridge method first gates context through `check_history`, then
calls the actual `usage_on` when a numerical snapshot is meaningful. Its result
contains `status`, `reason_codes`, `snapshot`, `history_result`, and `issues`.
The status describes history, not just the snapshot. Other methods serialize the
native result directly. A blocked snapshot remains null; a history inspection
limit may expose a factual final-date snapshot without claiming history passed.

Example boundary invocation (no separate calculation implementation):

```python
from schengenstay.browser import handle_json
import json

request = {
    "schema_version": 1, "method": "check_history",
    "stays": [{"kind": "completed", "id": "example",
               "entry": "2024-01-01", "exit": "2024-03-31"}],
    "as_of": "2024-03-31", "scope": "COUNTABLE_SHORT_STAYS",
    "history_complete": True,
}
response = json.loads(handle_json(json.dumps(request)))
assert response["result"]["status"] == "VIOLATION"
assert response["result"]["first_violation_date"] == "2024-03-31"
assert response["result"]["first_violation"]["used_days"] == 91
```

### Worker, state and presentation

The worker downloads the pinned runtime and relative Python source archive,
unpacks it, imports a fixed callable and passes JSON as data. It never constructs
Python source from user strings. Runtime output is suppressed to avoid exposing
travel records in logs. The main thread sends IDs and receives JSON-compatible
responses; there is no server calculation endpoint.

`PythonBridge` owns one worker, startup/request timers (60/30 seconds), an
eight-request pending cap, and cancellation by termination. A failure stops the
worker and rejects outstanding work; retry creates a fresh one. Worker-generation
checks discard messages from obsolete instances. `LatestResults` adds per-key
request tokens and input revisions. Editing relevant fields immediately clears
all results; a late success or failure cannot restore them. Language/theme-only
changes preserve language-neutral results. Keyboard focus is restored after
rendering and completion status is announced through the live region.

Date editing uses the reusable `date-input.js` presentation component across
check-date controls and history/scenario dialogs. A plain text draft is separate
from its strict ISO form value; input events never normalize visible partial text
or rebuild the editor. Validation occurs on blur/submission and uses existing
calendar validation helpers, without adding day-rule calculations. Calendar
selection commits an ISO date. Complete drafts reformat for English/Russian;
incomplete drafts survive locale and editor-mode changes. Runtime rerenders retain
the active date DOM node and selection. Check-date edits clear result slots and
metrics without replacing the active editor. Python contracts, persistence and
arithmetic are unchanged. See docs/FRONTEND.md for formats and keyboard controls.

Overview/Calculator call the real snapshot and history APIs. Scenario cards call
the corresponding fixed/max/earliest API. Fixed-date comparison uses
`compare_scenarios` and displays each independent nested result. No hypothetical
record is promoted to history. Search status and historical status remain separate;
maximum probe details may contain the first failing day without invalidating the
proven preceding prefix. Limited prefixes are explicitly unproven. Earliest-entry
failure within a horizon never means permanent impossibility unless the engine's
separate arithmetic proof flag says so. All outcomes remain non-authorizing.

The existing domain complexity/limits from sections 13–15 still apply. JSON
conversion is linear in request/result size. A history UI check currently obtains
both snapshot and history responses, so it performs two bounded history gates;
this favors explicit public API reuse over new caching or algorithm changes.
Worker placement protects the UI thread; timeout/cancel discards unfinished work
rather than inventing partial numerical answers. Actual domain partial-search
results retain their original proof/budget fields.

### Persistence boundary and verification

The UI stays in memory unless the user opts in. Only actual history and language/
theme preferences are saved under `schengenstay.workspace.v1`. Schema/consent,
UTF-8 size, record count/IDs, metadata, dates, overlaps and preference values are
validated before atomic restoration. Scope/complete/ongoing declarations, results
and hypothetical scenarios are intentionally not persisted. Disabling saving
removes only this app's saved key; memory records remain until reload. Storage
errors, including failed deletion, are visible. Labels and notes use text nodes.
JSON import/export remains Stage 7.

Tests exercise the unchanged domain APIs through JSON, real Pyodide, and UI forms.
Direct CPython reference outputs are compared recursively with browser worker
outputs for all six APIs/statuses, ongoing/invalid/overlapping inputs, 90/91 days,
rolling expiry, calendar boundaries, history/itinerary separation, limited search,
and 500 records. UI cases assert the same numerical/evidence results. Transport
unit tests cover out-of-order success/error, timeouts and cancellation. Browser
checks exercise stale loading responses, storage consent/reload/corruption,
translations, runtime failure/retry, repository-prefix hosting and network GETs.

Initial runtime loading remains a pinned external asset dependency, with normal
browser cache behavior only. Broader browser/physical-device/screen-reader testing,
full offline support, live Commission calculator comparison and public release
remain unclaimed. PROGRESS.md records only checks actually performed.

## 18. Stage 6 context gates and limitations

The user's Stage 6 authorization replaces the older roadmap integration-review
scope. This stage adds context handling, not an immigration-law decision system.
The Stage 1–3 models, validators, algorithms and signatures remain unchanged.
Official sources, supported questions, audit findings and deliberately unsupported
rules are recorded in [docs/LEGAL_CONTEXT.md](docs/LEGAL_CONTEXT.md).

### Additive version 1 boundary

Requests may include `legal_context: {kind, valid_from?, valid_until?}`.
`schengenstay.context.ContextKind` defines the supported kind strings. Omitting
this object retains legacy results and the existing explicit scope/completeness
requirements. Supplying null, a missing kind or `UNKNOWN` blocks unknown context;
unknown kind strings, extra fields and inconsistent date data are invalid.
Only `SHORT_STAY_VISA` accepts optional date fields. That kind denotes a request
for visa-conditions assessment, which remains unsupported, not every C-visa holder.
The arithmetic-only selection never overrides an unsupported existing scope.

`review_context(value) -> ContextReview` runs before arithmetic dispatch. Its
blocking status is propagated through the existing `CalculationScope` gate, so
none of the six entrypoints can generate reassuring snapshots or itinerary/search
results for those contexts. Existing request/history/plan validation still runs;
invalid input takes precedence. No days are reclassified, omitted or exempted.
Unknown fields in trip/proposal objects now fail structural validation instead of
being silently discarded. Existing documented valid version 1 inputs are unchanged.

Only requests carrying the new object gain a `context_review` response property:
`{status, kind, reason_codes, issues, visa_dates}`. A nullable auxiliary `status`
means no context error was identified, **not** legal approval or a seventh domain
status. Top-level results retain the six-status contract. History, itinerary and
search outcomes remain in their existing separate fields. Context reasons use
`ContextReason`, with English/Russian copy and unknown-code fallback text.

`check_visa_dates(valid_from=None, valid_until=None) -> VisaDateCheck` accepts ISO
strings and checks parsing and ordering only. Its fields are `status`,
`reason_codes`, parsed `valid_from`/`valid_until` and existing `ValidationIssue`
objects. Missing dates produce an auxiliary `INSUFFICIENT_DATA`; malformed or
reversed dates produce `INVALID_INPUT`. Consistent dates have null status and
`VISA_DATE_ORDER_ONLY`. The enclosing C-visa assessment remains `OUT_OF_SCOPE`.
No entry/duration/sticker-validity calculation, history-to-visa assignment or
visa-aware planning algorithm is implemented.

```python
from schengenstay.context import check_visa_dates, review_context
from schengenstay import ResultStatus

dates = check_visa_dates("2024-02-29", "2024-02-29")
assert dates.status is None  # Ordered dates, not a valid visa verdict.
assert review_context({"kind": "RESIDENCE_PERMIT"}).status is ResultStatus.OUT_OF_SCOPE
assert review_context({"kind": "UNKNOWN"}).status is ResultStatus.INSUFFICIENT_DATA
```

### Frontend and privacy

`context-ui.js` adds optional request-context selection, specific explanations,
and optional visa-date fields using the existing reusable date editor. It does
not implement legal rules in JavaScript. `context-i18n.js` contains all new EN/RU
copy. `pyodide-bridge.js` whitelists only kind/date values; Python remains
authoritative. New inputs invalidate pending/results immediately without replacing
the active editor. Language changes preserve drafts; no notes are interpreted.

History mutations revoke completeness/countability and ongoing confirmations;
the declared special context remains selected. Scenario edits do not change
actual history or these declarations. Context, visa dates and drafts remain in
memory even when history persistence is enabled. Existing storage schema and
validation are unchanged, and reload requires fresh declarations.

Context parsing and date checks are O(1) beyond the existing JSON size bound;
strict record-field checks are O(n), within the 500-record limit. Blocked requests
avoid occupancy scans. The deterministic archive includes the new Python module
and is byte-checked on Windows and Ubuntu. Tests cover every context across all
six methods, date-order properties, unchanged legacy outcomes, mixed histories,
strict fields, UI blocking, draft privacy and real CPython/Pyodide parity.
