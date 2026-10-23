# Browser application

Stage 5 connects the seven-screen HTML/CSS/vanilla JavaScript interface to the
existing Python package using **Pyodide 314.0.7** in a module Web Worker. There is
no JavaScript day-rule engine, backend, account, telemetry, or public deployment.
Stage 7 audits and stabilizes this implementation; see
[release readiness](RELEASE_READINESS.md) for tested environments and open gates.

## Run locally

Serve the checked-in `web/` directory with Python 3.12+:

```powershell
.\.venv\Scripts\python.exe -m http.server 8765 --bind 127.0.0.1 --directory web
```

On macOS/Linux, use `.venv/bin/python` instead. Open
[the local application](http://127.0.0.1:8765); stop the server with Ctrl+C.
This is a temporary static file server, not an application backend. Use HTTP,
not `file://`. No npm install or frontend build system is needed to use the site.

1. Enter actual completed or ongoing stays in Travel history.
2. On Overview, Calculator, or Planner, select the history check date, confirm
   completeness, and explicitly select the countable standard-short-stay scope.
   Unknown/special circumstances produce missing-information/unsupported results.
3. For ongoing records, explicitly confirm continuous presence through that date.
   Planning remains blocked until a confirmed actual exit replaces the ongoing stay.
4. Run a history check, evaluate an individual scenario, or compare fixed-date
   alternatives. Editing dates, records, bounds or declarations clears old results;
   run the relevant check again. Language/theme changes preserve valid results.
5. After adding, editing or removing history, confirm completeness/countability
   again. Optional **Scope and visa context** choices distinguish uncertain and
   unsupported situations; they never override an existing scope block. Optional
   C-visa date entry checks format/order only, never visa validity or trip rights.
   Details and official sources: [context boundaries](LEGAL_CONTEXT.md).

Initial Python loading downloads runtime assets from the pinned jsDelivr path.
Trips are not transmitted with those downloads. Calculation starts on the first
request; ordinary navigation and editing work before Python loads. Cached assets
may allow later offline use, but **offline availability is not guaranteed**.

## Working screens

| Screen | Connected behavior |
| --- | --- |
| Overview | Selected-date Python usage/remaining snapshot, independent full-history assessment, recent trips, calendar |
| History | Completed/ongoing trip CRUD, basic date/order/overlap feedback, optional text labels and notes |
| Calculator | All-history check, first violation and its exact window, separate final-date snapshot, inspection evidence |
| Planner | Fixed-trip evaluation, bounded maximum stay, earliest-entry search, independent fixed-date comparison |
| Calendar | Entered completed and fixed-tentative intervals; ongoing intervals only through an explicitly confirmed check date |
| Settings | English/Russian, light/dark, opt-in history saving, disable/delete saved data |
| How it works | General rule explanation, official reference link, independent/informational limitations |

No sample history or successful result is seeded. Empty history yields numbers
only after an actual check with explicit declarations. Remaining days describe
the selected date, **not** a guaranteed future continuous stay. A historical
violation survives a later passing proposal. Search status is shown separately
from aggregate status; limited prefixes are never called proven maxima.

All six statuses are presented: `WITHIN_RULE`, `VIOLATION`, `INVALID_INPUT`,
`INSUFFICIENT_DATA`, `OUT_OF_SCOPE`, `HORIZON_LIMIT`. Reasons and validation codes
have English/Russian copy plus safe fallback text for unexpected codes. Search
probe details explicitly identify a potentially failing day; an earliest-search
candidate is labeled as found or last attempted. Neither is travel permission.

## Date entry

Every history, check-date and scenario field uses the same text-and-calendar
component. Type **DD/MM/YYYY** in English or **DD.MM.YYYY** in Russian; complete
ISO **YYYY-MM-DD** dates can also be pasted. Text remains editable with ordinary
selection/cursor behavior. Partial input is never rewritten into a different year.
Errors appear on blur or submission, not during typing. Impossible dates and
out-of-range values must be corrected before saving or requesting calculations.

The calendar button or **Alt+Down** opens the inline picker. Arrow keys move by
day/week; Home/End select the week's ends; Page Up/Down change months (with Shift,
years). Enter selects the focused day. Escape closes the picker without changing
the date; in an editor, a second Escape closes the editor. Month/year controls,
Today and Clear are available. Focus and selection use scoped green/sage colors
in both themes, retaining system focus colors in forced-colors mode.

`date-input.js` separates the visible text draft from the canonical hidden ISO
value. Only complete real dates produce an ISO value; existing store/Python
validation remains authoritative. App rerenders preserve the active date control,
selection and calendar. Valid dates reformat on language changes; unfinished text
is retained verbatim and must be completed in the newly selected format. Editor
mode changes retain date drafts; Cancel discards unsaved changes. Drafts are not
saved to browser storage. Editing the check date immediately invalidates results.

## Runtime, packaging and modules

- `python-worker.js` imports
  `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs`, then calls
  `loadPyodide` with the same pinned asset directory. No floating `latest` URL.
- It fetches `web/python/schengenstay.zip` relative to its module URL, unpacks it
  into Pyodide's working directory, and imports `schengenstay.browser.handle_json`
  with one fixed Python statement. Requests are JSON strings passed to that
  callable, never interpolated into Python source. Labels/notes are not sent to
  the calculation worker. No dynamic package installation is needed.
- `scripts/build_browser.py` creates that small deterministic archive from **all**
  `src/schengenstay/*.py`, normalizing UTF-8 text to LF, sorting entries and fixing
  timestamps, permissions and the ZIP creator-system field to Unix on every host.
  Entries use `ZIP_STORED` so zlib versions cannot change the bytes; the current
  bundle is about 60 KB. CI retains exact byte equality on Windows and Linux. The
  archive is intentionally committed for direct static serving. It contains no
  bytecode, tests, private data or third-party libraries. After Python changes:

```sh
python scripts/build_browser.py
python scripts/build_browser.py --check
```

- CI checks archive/source equality to prevent a stale browser engine. Relative
  paths work under a repository prefix; integration tests serve `/SchengenStay/`.
- `pyodide-bridge.js` handles startup, IDs, timeouts, cancellation and response
  validation. `LatestResults` uses input revisions and per-request tokens to
  discard stale successes and failures. Results are invalidated immediately on
  relevant changes, even while initialization is pending.
- Startup timeout: **60 seconds**; request/queue timeout: **30 seconds**, with at
  most eight pending requests. Timeout/cancel terminates the worker, discards
  partial work and allows a fresh initialization. It is a transport error, never
  a fabricated domain `HORIZON_LIMIT`. Domain inspection/horizon limits remain
  the Python package's independent bounds. No cross-origin isolation or shared
  memory is required.
- `browser.py` parses strict ISO dates, converts records to existing immutable
  models, defaults unconfirmed context to incomplete/unknown, delegates to the
  six public APIs, and recursively serializes results. Invalid date/type values
  remain available to the authoritative domain validator.
- `results.js` presents structured evidence and context controls;
  `integration-i18n.js` provides integration copy and all current code translations.
  The original views/components retain their seven-screen layout. `dates.js`
  only formats dates, navigates months and marks entered intervals.
- `storage.js` owns the only localStorage access; `store.js` owns immutable
  history/scenario records. `app.js` connects lifecycle, state and views.
- The entry CSP permits same-origin assets/worker plus only the pinned runtime
  directory and WebAssembly compilation. It does not allow JavaScript `eval`,
  form submission or arbitrary remote origins. Static hosts with response-header
  support should also apply the worker's resource policy; a document meta CSP
  is not a substitute for a separately served worker response policy.

See [architecture section 17](../ARCHITECTURE.md#17-stage-5-pythonbrowser-integration)
for the exact JSON contract. Pyodide's official
[JavaScript API](https://pyodide.org/en/314.0.7/usage/api/js-api.html) documents
`loadPyodide`, `unpackArchive` and Python proxy calls; its
[release record](https://github.com/pyodide/pyodide/releases/tag/314.0.7)
identifies the pinned runtime. These are runtime documentation, not legal sources.

## Privacy and storage

Memory is the default. Settings offers explicit opt-in to save **actual history,
labels/notes, language and appearance** in this browser profile. The consent
choice is included in the saved versioned envelope, allowing restoration only
when it is present and valid. Scenarios, results, scope declarations and
completeness/ongoing confirmations are never saved. Confirm again after reload.

The single key is `schengenstay.workspace.v1`, schema version 1. Input is capped
at 512,000 UTF-8 bytes and 500 history records; duplicate IDs, unknown fields,
bad dates, contradictory ongoing exits, overlaps, excessive metadata and invalid
preferences are rejected atomically. No partial restoration is performed.
IDs are at most 100 characters, labels 80, notes 500. All text uses DOM text nodes.
The consent applies to shared-device risks; no identity documents are requested.

Disabling saving or using **Disable saving & delete saved data** removes this
app's saved key, preserves other sites' data, and keeps current in-memory entries
until reload/closure. Corrupt/blocked storage, quota failures and failed deletion
are surfaced explicitly. If browser permissions block deletion, clear this site's
data in browser settings. Browser cleanup can erase saved history. JSON
import/export remains deferred to separate authorization. Context choices and
visa dates are never saved, even with consent enabled.

## Checks

With the Python development environment installed and Node 22+:

```sh
python -m pytest -q
ruff check .
python -m pip check
node --test tests/frontend/*.test.mjs
python scripts/build_browser.py --check
python scripts/check_docs.py
```

Browser tooling is test-only **Playwright 1.62.1**. CI installs it and Chromium
on Ubuntu and Windows. If it is not already available locally:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/frontend/browser.mjs
node tests/frontend/python-browser.mjs
```

Alternatively set `BROWSER_EXECUTABLE` to an installed Chrome/Chromium executable;
set `NODE_PATH` if Playwright is supplied by shared tooling. `PYTHON_EXECUTABLE`
can select the installed Python 3.12+ interpreter for parity tests (Windows
otherwise uses `.venv/Scripts/python.exe`, other systems `python`). Both suites
start/stop their own temporary loopback server and browser. The integration suite
requires access to the pinned runtime; failed downloads fail the test honestly.

The integration suite also accepts `BROWSER_ENGINE=firefox` or `webkit` after
`npx playwright install firefox webkit`. Unset `BROWSER_EXECUTABLE` for bundled
engines. For installed Edge, retain the default Chromium engine and set
`BROWSER_EXECUTABLE` to its executable. Firefox uses viewport sizing without
Playwright's unsupported mobile-emulation flag. Windows WebKit is not Apple Safari.
The interface suite uses Chromium (including Chrome/Edge) for its real clipboard
checks; cross-engine date/keyboard/responsive journeys are in the integration suite.

`browser.mjs` covers existing CRUD/forms, focus/keyboard, text safety, language,
theme, seven-screen layouts at 1440/768/390/320 pixels, and startup failure.
It also runs `date-input-browser.mjs`: character-by-character Russian entry,
year replacement, actual clipboard paste, impossible dates, picker selection and
keyboard/boundary navigation, modal drafts, locale/theme changes, forced colors
and mobile picker layout. Node tests cover localized parsing and draft retention.
`python-browser.mjs` exercises real Python UI calculations, full-response parity
against direct CPython APIs from `tests/browser_cases.py`, explicit assumptions,
ongoing blocking, partial searches, consent/reload/corruption, stale loading
responses, CDN failure/retry, and static-GET-only network traffic. It verifies
that unfinished date text, its DOM node and caret survive real Python startup.
It records
first-use desktop/mobile-viewport timing and a 500-record history. It does not
pretend to emulate physical mobile CPU/network performance.

Node tests additionally simulate transport ordering, timeout and cancellation;
such tests exercise lifecycle handling, not fake successful travel calculations.
Python tests cover boundary conversion, serialization, authoritative validation,
all public functions, and a deterministic ISO-date round-trip property. Existing
Stage 1–3 arithmetic/property/official-fixture tests are unchanged. Browser suites
now run in CI as well as locally. `release-browser.mjs` adds complete editing
journeys, cross-engine responsive/date controls, real worker cancellation/retry
and initialized-worker offline calculation. Stress/parity cases cover 500 records,
10,000 occupied days, a long bounded search and 100 independent scenarios. A local
pass does not establish remote CI success or broad cross-browser certification.

## Troubleshooting and remaining limits

- A loading error: check internet/CDN access, then use **Retry Python loading** or
  run again. Do not interpret a missing response as success. Files may be cached,
  but no service worker, offline installation or PWA is implemented.
- Package 404/import error: serve the whole `web/` directory, confirm the archive
  exists and run its `--check`. After edits regenerate it and reload the page.
- Inspection/search limit: increase the relevant bound within Python limits or
  narrow the request. A transport timeout requires retrying a smaller request.
- Ongoing stay: choose/confirm its explicit through-date; future planning requires
  an actual exit. Changing history or the check date resets ongoing confirmation.
- Calendar markers are entered intervals, not an eligibility heatmap. Maximum
  and earliest searches do not silently create or persist trips.
- Chrome, Edge, Firefox and Windows WebKit desktop/mobile-sized viewports are
  checked. Apple Safari, physical devices and screen readers remain unverified.
- No visa/residence/nationality adjudication or permission to enter/stay. Existing
  published Commission examples still pass; twelve live official-calculator cases
  were compared in Stage 7. No public deployment has been performed.

## Actual screenshots

Empty-first Stage 5 workspace, captured in Chrome with the interface test clock
set to 23 October 2026. No invented calculation values or personal history:

- [Desktop overview](images/overview-desktop.png)
- [Mobile overview](images/overview-mobile.png)

Exact local verification evidence and remaining work are in
[PROGRESS.md](../PROGRESS.md).
