# SchengenStay — Technical Architecture

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
