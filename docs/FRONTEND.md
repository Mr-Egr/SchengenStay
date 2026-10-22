# Frontend preview

Stage 4 is a standalone HTML/CSS/vanilla JavaScript interface. It has no build
step, third-party browser dependencies, backend, external assets, analytics,
accounts, storage, or calculation calls. The existing Python engine is separate.
The user explicitly moved Pyodide integration to Stage 5, superseding the earlier
roadmap order. This is a functional interface preview, not a working web calculator.

## Run locally

From the repository root, with Python 3.12+:

```sh
python -m http.server 8765 --bind 127.0.0.1 --directory web
```

With the existing Windows environment:

```powershell
.\.venv\Scripts\python.exe -m http.server 8765 --bind 127.0.0.1 --directory web
```

Open [the local preview](http://127.0.0.1:8765). Stop it with Ctrl+C. This serves
static files on loopback only; it is not an application backend or deployment.
Use HTTP rather than opening `index.html` with `file://`, because the interface
uses ES modules. No Node installation is needed to preview it. Use a current
browser supporting native date inputs, dialogs, ES modules, and modern CSS.

## What works

| Screen | Stage 4 behavior |
| --- | --- |
| Overview | Empty-first workspace, actual entered-trip count, recent trips, quick actions, mini calendar; day-used/day-remaining values are dashes |
| Travel history | Add/edit/remove completed trips, optional labels/notes, date/order/future/overlap feedback, removal confirmation |
| Calculator | Select a check date; empty/unavailable presentation, disabled calculation control with explanation; no result |
| Travel planner | Add/edit/remove independent fixed-date, maximum-stay, and earliest-entry scenarios; every result explicitly says not evaluated |
| Calendar | Month navigation, keyboard date selection, inclusive recorded/fixed-tentative markers, accessible date descriptions and detail list |
| Settings | English/Russian interface and localized dates; light/dark appearance; session-only privacy information |
| How it works | Simple general rule explanation, independent/informational disclaimer, link to the Commission's guidance |

Trips and scenarios start empty. No sample travel or result values are silently
inserted. Even an empty history does not display “90 days remaining.” Recorded
and tentative calendar markers indicate entered date ranges only, not eligibility
or compliance. Maximum/earliest-entry search requests have no implied departure
and do not mark calendar dates. All user text is rendered as text nodes.

Refreshing or closing the tab clears trips, scenarios, language, and appearance.
The app writes no localStorage, sessionStorage, IndexedDB, cookies, URL travel
parameters, or logs containing trip data. It does not request identity details.
Do not use it as a durable travel record or enter sensitive personal information.

## Modules and boundaries

- `web/index.html`: semantic entry document, no-script explanation, restrictive
  content-security policy; `connect-src 'none'` blocks network data requests.
- `web/scripts/bootstrap.js`: imports the app; renders an honest startup failure
  and reload action if loading fails. No artificial loading delay.
- `app.js`: hash navigation, screen composition, session preferences, announcements.
- `views.js`: seven screens built from reusable presentation components.
- `components.js`: dialogs, forms, metrics, trip list, calendar, and unavailable,
  empty, loading, and error result presentations. Loading/error calculation states
  are tested components for Stage 5; they are not simulated in the live preview.
- `store.js`: immutable in-memory records and basic form validation; explicit caps
  of 500 trips, 100 scenarios, 80 label characters, and 500 note characters.
- `dates.js`: strict ISO date presentation, calendar month generation, and interval
  membership for markers. No rolling windows, occupancy totals, or stay searches.
- `i18n.js`: matching English/Russian dictionaries with named interpolation.
- `dom.js`: safe DOM construction, local SVG icons, field errors, announcements.
- `web/styles/main.css`: responsive design tokens, themes, visible focus, reduced
  motion support. `web/assets/` contains original decorative SVGs, no official logos.

History inputs require entry/exit dates in the existing compliance calendar range
`0001-06-29`–`9999-12-31`; both dates are required. Completed stays cannot end after
the device's local date captured at session start. Proposed entries must follow
that date. Ongoing stays are intentionally unavailable. Basic overlapping-history
checks are input feedback only; they never certify completeness or legal grounds.
Scenario duration/horizon accept integers 1–10,000; values over 90 are not given
an arithmetic verdict in JavaScript. Full search/date/inspection validation stays
with Python. Frontend errors are separate from the Python six-status contract.

## Checks

No installation is needed for the standard frontend checks with Node.js 22+:

```sh
node --test tests/frontend/state.test.mjs
python scripts/check_docs.py
```

`package.json` supplies optional `npm test` and `npm run test:browser` shortcuts,
declares ES modules, and has no runtime or development dependency installation.
Python checks remain `python -m pytest -q`, `ruff check .`, and `python -m pip check`
in the installed Python 3.12+ environment. CI runs Python, frontend unit/static,
and documentation checks; browser tests are a separate optional local check.

The browser suite uses Playwright **1.62.1** as test-only tooling. If it is not
already available, install it locally without changing the package manifest:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/frontend/browser.mjs
```

Alternatively set `BROWSER_EXECUTABLE` to an installed Chrome/Chromium executable;
then the browser download is unnecessary. When using existing shared test tooling,
`NODE_PATH` can point to the directory containing its `playwright` package. The
suite starts and stops its own temporary loopback-only static server and browser.
`SCREENSHOT_DIR` optionally writes actual desktop/mobile screenshots. Example:

```powershell
$env:BROWSER_EXECUTABLE = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:SCREENSHOT_DIR = '.tmp/screenshots'
node tests/frontend/browser.mjs
```

Browser checks cover trip/scenario CRUD, validation, text safety, dialog keyboard
focus and cancellation, calendar navigation/markers, unavailable/empty states,
startup failure, language/theme changes, reload-cleared state, control names,
contrast-token pairs, and overflow across seven screens in both languages at
1440, 768, 390, and 320 pixels. This is accessibility-basics validation, not WCAG
certification or a substitute for screen-reader and real-device testing. Native
date controls follow browser/OS settings; displayed dates use the selected language
with explicit UTC formatting to preserve their calendar day.

## Actual screenshots

Captured from the empty interface in desktop Chrome, with the test clock set to
23 October 2026. They contain no fabricated results or personal travel history.

- [Desktop overview](images/overview-desktop.png)
- [Mobile overview](images/overview-mobile.png)

## Stage 5 handoff

1. Add a pinned Pyodide runtime and preferably a worker, plus a versioned fixed JSON
   bridge. Update CSP only for the actual runtime/worker asset requirements.
2. Parse ISO strings with Python's `parse_iso_date`; retain Python as the sole
   calculation authority. UI labels are separate metadata, not geography or legal
   scope. Completed records map to `ShortStay(id, entry, exit, note)`; fixed-date
   proposals map to `PlannedStay(entry, exit)` without entering actual history.
3. Collect explicit `as_of`, countability/scope, and history-completeness declarations.
   Do not silently use Python's affirmative defaults for unconfirmed UI context.
   Add ongoing-stay UI only with its explicit check-date semantics and confirmed-exit
   requirement for future planning.
4. Connect `usage_on`/`check_history`, `check_plan`, `max_continuous_stay`,
   `find_earliest_entry`, and `compare_scenarios`. Preserve all six domain statuses,
   reasons, scope notes, first-violation evidence, separate historical/itinerary
   findings, search limits, and `planning_status` alongside aggregate status.
5. Replace unavailable states only when real responses exist; handle load/failure,
   stale responses after edits, request IDs, and bounded work. Never present a
   partial maximum or exhausted horizon as a verified travel allowance.
6. Implement local persistence only with informed opt-in, versioned validation,
   clear/delete controls, and privacy tests. No account or remote history service.
7. Test browser/Python parity against existing fixtures, add integration tests,
   and broaden accessibility and real-device verification before any deployment.
