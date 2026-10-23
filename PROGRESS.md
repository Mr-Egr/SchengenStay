# Progress record

## 2026-10-23 — Stage 7 final testing and quality assurance

Started from clean `main`/`origin/main` at `85a0252`. Read the required product,
architecture, rules, roadmap, progress, frontend and legal-context documents and
inspected all implemented Python/browser layers and their tests. The full
[release-readiness checklist](docs/RELEASE_READINESS.md) records PASS, WARNING and
BLOCKER findings, sources, exact coverage, performance and attribution scope.

### Defects and changes

- Medium: late obsolete-worker errors could stop a replacement; readiness/cancel
  races could forward canceled work; failed sends left pending timers/queue entries.
  Added worker-instance guards and normal failure cleanup, with three unit
  regressions reproduced before fixing. Existing revision guards remain intact.
- Medium: editing the inspection bound retained old results until blur. Results
  now invalidate on input without replacing the field; browser regression added.
- Medium: raw JSON duplicate keys could replace unknown/incomplete context with
  affirmative fields. Reject all duplicate object names, including nested ones,
  as structured invalid input. Three regressions reproduced the old positive
  results; a 300-example malformed-input property checks safe structured responses.
- Low: package description still said scaffold; metadata now describes the
  implemented calculator/planner. No core arithmetic, compliance, planner,
  legal rule, model or date-input component was changed.

New files: `docs/RELEASE_READINESS.md`,
`tests/fixtures/official_live_2026-10-23.json`, `tests/test_official_live.py`,
`tests/test_release_boundary.py`, `tests/frontend/release-browser.mjs`.

Modified: Python browser adapter and deterministic archive; frontend app,
results and worker bridge; native browser reference cases and frontend integration
tests; CI workflow; package description; README, ARCHITECTURE, CALCULATION_RULES,
ROADMAP, CONTRIBUTING, docs/FRONTEND and this record.

### Verification actually performed

Windows host, native Python 3.12.14, Node 24.19.0 and Playwright 1.62.1. Downloaded
test-only Firefox/WebKit into ignored `.tmp/browsers`; no application dependency
was added. Sandbox temp permission errors were resolved using ignored workspace
temp directories. The wheel build required its declared isolated setuptools build
dependency; a no-isolation attempt lacked that build tool, then the normal isolated
build succeeded. No package or tests were changed to bypass those environment issues.

| Check | Outcome |
| --- | --- |
| `python -m pytest -q --hypothesis-show-statistics` | 405 passed in 10.09s; all 389 prior tests retained |
| Hypothesis | 18 properties; 17 × 200 plus 300 passing examples (3,700 total); generated/discarded candidates are not skipped tests |
| `ruff check .` | Passed |
| `python -m pip check` | No broken requirements |
| `node --test tests/frontend/*.test.mjs` | 36 passed, none skipped |
| Chrome and Edge interface/date/accessibility suite | 26 checks passed per browser, including real clipboard paste |
| Chrome, Edge, Firefox and Windows WebKit integration suite | 23 groups and 99 full native-Python/Pyodide comparisons passed per browser |
| Official manual | Six existing published arithmetic cases reread and matched; derived cases remain labeled |
| Official live calculator | 12 synthetic standard-short-stay comparisons matched; exact observations recorded in dated fixture |
| Browser source archive | 58,404-byte canonical ZIP matches source; cross-platform metadata/newline tests pass |
| Documentation | Local links/anchors and five executable API examples pass |
| Python wheel | Build succeeds; 11 module payloads match source; metadata/version/Python range correct; no extra package files or runtime requirements |
| Tracked/candidate file review | No common token/private-key/credential pattern matches or accidental cache/build/temp files |

Full editing journeys, every screen, both languages/themes, 1440/768/390/320px,
date typing/year replacement/picker, invalid input, context revocation, privacy,
storage deletion/corruption/reload, stale results, failures/cancellation and retry
were exercised. Firefox's failure test needed a 90-second observation window for
the application's unchanged 60-second startup timeout; assertions were retained.
Installed Chrome/Edge, bundled Firefox and Windows WebKit all completed the tests.
No physical-device, Apple Safari or screen-reader testing is claimed.

Representative first desktop calculations: Chrome 1.99s, Edge 2.49s, Firefox
11.59s, WebKit 3.13s. Warm 10,000-occupied-day history: approximately 0.96s, 0.95s,
8.64s and 1.11s respectively. Exact startup, percentile, mobile-viewport, search
and scenario timings and cache/workload limitations are in the QA record.

CI retains all Ubuntu/Windows checks and now installs pinned browser tooling to
run Chromium UI and real Python integration suites on both. The corresponding
post-push Actions results are checked and reported in delivery, not inferred from
local success. No checks were disabled, skipped, downgraded or replaced with mocks.

### Remaining gates and stop boundary

Technical checks pass; no reproducible critical/high-severity defect remains
from the audited cases. Public distribution is **not cleared**: the owner has not
chosen a project license. Pinned upstream runtime terms and local asset origins
are inventoried; exact deployment attribution/headers still need review. External
runtime integrity, untested hardware/assistive technology, cold/limited-network
guarantees and full transitive tool locking remain documented warnings. Legal
context is still caller-declared, with unsupported circumstances blocked.

No Stage 8 deployment, repository-visibility change, license invention, release
publication, account/backend, commercial feature or history rewrite was performed.
Stop after the verified Stage 7 commit/push for review.

## 2026-10-23 — Stage 6 context and calculation limitations

Started from clean `main`/`origin/main` at `f09ec43`. Read the product, calculation,
architecture, roadmap and progress documents; audited the implemented Python
engine/planner, JSON bridge, context inputs, date components, result presentation,
state, persistence and tests. The user's current instruction supersedes the old
Stage 6 roadmap scope. Stage 7 release validation and Stage 8 deployment have
not started.

### Audit and implemented scope

- Generic scope choices did not explain individual visa/residence/mixed cases.
  Added an optional request-context selector with specific EN/RU explanations.
  Unknown countability blocks with `INSUFFICIENT_DATA`; unsupported legal
  questions block with `OUT_OF_SCOPE` before occupancy calculations.
- History edits retained old completeness/countability declarations. Those
  declarations and ongoing confirmation now reset after history mutations;
  the chosen special context remains selected. Scenarios remain independent.
- The JSON adapter discarded unrecognized trip/proposal fields. Such fields now
  fail validation rather than silently ignoring possible countability metadata.
- Optional C-visa date entry checks strict dates and chronological order only.
  Missing/reversed/impossible dates have explicit outcomes. An ordered pair is
  never `WITHIN_RULE` for a visa; C-visa conditions assessment remains unsupported.
  No entry/duration allowance, residency right or permission is inferred.
- Standard arithmetic remains available for complete, explicitly countable short
  stays, including visa-free or C-visa travel. Its scope does not establish visa
  compliance. Unknown/special periods are not automatically counted or exempted.
- Context and visa drafts stay in memory and never enter opt-in history storage.
  Existing date editors, seven screens, themes, worker/static hosting and all six
  top-level statuses remain. No new dependency, backend or personal-data field.

The actual Stage 1–3 date, validation, compliance, planner and model source files
are unchanged. Legacy documented requests without context retain their result
shape; context-bearing requests add `context_review`. Details, source URLs and
scope limits are in [docs/LEGAL_CONTEXT.md](docs/LEGAL_CONTEXT.md) and architecture
section 18. No broad visa adjudication or live official-calculator parity is claimed.

### Files

New:

- `src/schengenstay/context.py` — conservative scope review and date consistency.
- `web/scripts/context-ui.js`, `context-i18n.js` — reusable optional controls,
  separate context evidence and bilingual text with fallback explanations.
- `tests/test_context.py`, `tests/frontend/context-browser.mjs` — context/date
  unit/property tests and real browser scope/privacy/date interaction checks.
- `docs/LEGAL_CONTEXT.md` — supported questions, source register and exclusions.

Modified:

- `src/schengenstay/browser.py` and `web/python/schengenstay.zip` — context gating,
  strict record fields, additive JSON evidence and regenerated deterministic bundle.
- `web/scripts/app.js`, `i18n.js`, `pyodide-bridge.js`, `results.js`, `views.js`,
  `web/styles/main.css` — input state, re-confirmation, bridge whitelist, result
  separation, help and scoped styling; no JavaScript compliance calculations.
- `tests/browser_cases.py`, `tests/frontend/integration.test.mjs`,
  `tests/frontend/python-browser.mjs` — new context parity and privacy checks;
  existing browser cases now explicitly reconfirm after history edits, retaining
  all their numerical/status assertions and adding assertions for the new gate.
- README.md, ARCHITECTURE.md, CALCULATION_RULES.md, CONTRIBUTING.md, ROADMAP.md,
  docs/FRONTEND.md and this record — accurate Stage 6 scope and developer guidance.

### Verification actually performed

Python 3.12.14, Node 24.19.0, existing Playwright 1.62.1 and Chrome 155.0.8059.85
on Windows; no package installations. Pytest used the ignored `.tmp/pytest`
workspace directory because of local sandbox temporary-directory permissions.

| Check | Result |
| --- | --- |
| `python -m pytest -q` | 389 passed, including all 305 prior tests and 84 context cases |
| `ruff check .` | Passed |
| `python -m pip check` | No broken requirements |
| `node --test tests/frontend/*.test.mjs` | 33 passed |
| `node tests/frontend/browser.mjs` | 26 interface/date/accessibility checks passed |
| `node tests/frontend/python-browser.mjs` | 19 real integration checks; 96 complete native-Python/Pyodide comparisons passed |
| `python scripts/build_browser.py --check` | Exact source/archive equality passed, including platform/line-ending regressions |
| `python scripts/check_docs.py` | Local links/anchors and all five executable API examples passed |
| `git diff --check` | No whitespace errors |

Parity retains the original 18 direct-domain reference cases and adds 78 native
boundary references across all six methods and context/date combinations. Their
expected status/precedence/no-success semantics are independently asserted in
unit tests. A new 200-example deterministic property checks arbitrary visa date
pairs without deriving legal success. Browser checks cover EN/RU, both themes,
320px context/date forms, keyboard/Escape, reconfirmation, privacy, stale-response
handling and unchanged existing responsive/500-record workflows. First use was
about 2.5 seconds on desktop and 2.4 seconds in a mobile viewport in this local
run; these are observations, not physical-phone or slow-network guarantees.

The unchanged CI matrix runs Python 3.12/Node 22 checks on Ubuntu and Windows.
The actual post-push run conclusion and link are verified and reported in the
delivery message, separately from local results.

### Remaining limitations

Official Commission and national government sources were verified for the narrow
scope statements and date-field meanings in the source register. The attempted
EUR-Lex text was blocked by an anti-bot challenge; no rule depends on it. No
pending-application, stamp, national-extension, bilateral, nationality or mixed
residence entitlement rule was verified or implemented. Entry limits and visa
duration are separate unimplemented constraints; historical country membership
is not inferred. User declarations remain unverifiable. No physical-device,
Safari/Firefox or screen-reader certification, release approval, live Commission
calculator comparison or deployment is claimed.

## 2026-10-23 — Repair cross-platform CI archive checks

Inspected GitHub Actions through the installed GitHub CLI. Both the Stage 5
[85d51bf run](https://github.com/Mr-Egr/SchengenStay/actions/runs/39864445655)
and the date UX [bc3f1fd run](https://github.com/Mr-Egr/SchengenStay/actions/runs/39868587043)
failed at **Browser Python source archive consistency**, with the exact error:

```text
Browser archive is stale; run python scripts/build_browser.py
Error: Process completed with exit code 1.
```

The committed ZIP was built on Windows (`ZipInfo.create_system == 0`), while
Ubuntu's default is `3`. The builder fixed dates/permissions but omitted this
field. Reproducing Linux metadata defaults locally changed exactly ten bytes in
the 16,711-byte archive, one creator-system byte per Python member; all ten source
payloads were identical. Local Windows checks therefore passed while Linux's
strict byte comparison correctly rejected the different artifact. CI Python
3.12.15 versus local 3.12.14 was not the source of these metadata differences.

Changes:

- `scripts/build_browser.py` fixes creator metadata to Unix on every host and
  uses stored ZIP entries to remove compression-library variation as well. The
  regenerated `web/python/schengenstay.zip` is 50,437 bytes; source is unchanged.
- `tests/test_browser_archive.py` adds five checks: simulated Windows/Linux/macOS
  metadata defaults, LF/CRLF and UTF-8 content, sorted source-only membership,
  canonical metadata, real source-change detection and exact committed bytes.
- `.github/workflows/ci.yml` now runs all existing checks on both Ubuntu and
  Windows, with Python 3.12 and Node 22. Exact archive equality remains enforced;
  CI does not regenerate the bundle or suppress failures.
- CONTRIBUTING.md and docs/FRONTEND.md document the shared archive format and CI
  platforms. No application, calculation, result-contract or dependency changes.

Local verification: **305 pytest tests, 32 frontend tests, 26 Chrome interface
checks, and 14 real Python/browser integration checks with 18 complete CPython
parity cases passed**. Ruff, pip dependency consistency, byte-for-byte archive
consistency, documentation checks (29 links/anchors and four API examples) and
Git whitespace checks passed. Used Python 3.12.14, Node 24.19.0 and Chrome
155.0.8059.85; the Node 22/Linux environment is verified by the actual CI run.
The sandbox denied pytest's default temporary directory, so the local test run
set `PYTEST_DEBUG_TEMPROOT` to the ignored workspace `.tmp/pytest` directory;
no test or repository setting was skipped or relaxed.

The new remote run is checked after pushing this repair; its actual conclusion
and URL are reported in the delivery message, separately from local results.
Stage 6 and deployment remain untouched.

## 2026-10-23 — Date input UX fix before Stage 6

Started from clean `main`/`origin/main` at `85d51bf`. Audited the check-date
controls in Overview, Calculator and Planner, completed/ongoing history editors,
and fixed/maximum/earliest scenario editors. No additional date inputs exist in
the calendar or confirmation dialogs. Stage 6 has not started.

### Cause and changes

Chrome's native date control edits separate date segments and can emit an early
year such as `0002`. The check-date change handler immediately rebuilt the app
and restored focus, disrupting the in-progress segmented edit. Native selection
styling also did not match the product's green palette.

- Added reusable `web/scripts/date-input.js`: ordinary text editing, English
  `DD/MM/YYYY` and Russian `DD.MM.YYYY`, ISO paste, separate canonical ISO value,
  blur/submit validation, accessible inline calendar, month/year navigation,
  Today/Clear, keyboard controls and nested Escape behavior.
- Updated `app.js`, `components.js`, `results.js`, `views.js` and `dom.js` to use shared date
  drafts, retain editor values/focus/caret during rerenders, show errors on the
  visible input, and clear stale results without replacing the active editor.
  Calendar evidence also clears when a date edit revokes ongoing confirmation.
- Updated `integration-i18n.js` and `web/styles/main.css` with localized hints,
  errors and calendar labels, scoped green/sage selection/focus, dark-theme and
  forced-colors support. No global focus suppression or new dependencies.
- Added `tests/frontend/date-input.test.mjs` and `date-input-browser.mjs`;
  extended `browser.mjs` and `python-browser.mjs` with date editing and actual
  runtime-loading regressions. Updated ARCHITECTURE.md and docs/FRONTEND.md.
  README stays concise and unchanged.

Python source, arithmetic, compliance rules, public result contracts, source
archive, worker and storage schema are unchanged. Raw editing drafts are never
persisted. Complete dates reformat on language changes; unfinished text is kept
verbatim and must be completed in the current language's format. Canceling an
editor intentionally discards its unsaved draft.

### Verification

Used Python 3.12.14, Node 24.19.0, existing test-only Playwright 1.62.1 and installed
Chrome 155.0.8059.85 on Windows. No dependencies were added or installed.

| Check | Result |
| --- | --- |
| `python -m pytest -q` | 300 passed |
| `ruff check .` | Passed |
| `python -m pip check` | No broken requirements |
| `node --test tests/frontend/*.test.mjs` | 32 passed |
| `node tests/frontend/browser.mjs` | 26 interface checks passed |
| `node tests/frontend/python-browser.mjs` | 14 real integration checks passed, including 18 full-response CPython parity cases |
| `python scripts/build_browser.py --check` | Browser archive matches unchanged Python source |
| `python scripts/check_docs.py` | 29 local links/anchors and 4 executable API examples passed |
| `git diff --check` | No whitespace errors |

Regressions cover typing `30.09.2026` one character at a time without cursor/node
replacement, replacing the year, real clipboard paste, clearing, impossible and
leap dates, calendar selection, date bounds, keyboard/Escape, modal/mode changes,
and draft retention during real Pyodide startup. Date controls were exercised in
both languages/themes at desktop, 390px and 320px widths, including a narrow modal
and forced-colors focus. Existing interface tests also cover tablet layouts.

Mobile checks use Chrome viewport sizes, not physical phones. Firefox, Safari and
screen-reader certification remain unverified. The known Stage 5 runtime/offline
and legal limitations remain unchanged. No deployment or Stage 6 work was done.

## 2026-10-23 — Stage 5 Python/browser integration

Started from clean `main`/`origin/main` at `398a676`. Read PRODUCT.md,
ARCHITECTURE.md, CALCULATION_RULES.md, ROADMAP.md, this progress record and
`docs/FRONTEND.md`; inspected the Stage 1–4 source, models, public APIs and tests.
The user authorized this integration and one commit/push after verification.
The underlying Stage 1–3 algorithms and existing Python tests are unchanged.

### Implemented

- Pinned **Pyodide 314.0.7** running the actual source package in a module worker.
  A deterministic, committed Python archive makes `web/` directly servable.
  No JavaScript day-rule implementation, backend or runtime package install.
- Version 1 JSON boundary calls all six existing public functions: `usage_on`,
  `check_history`, `check_plan`, `max_continuous_stay`, `find_earliest_entry`,
  `compare_scenarios`. Safe ISO/model conversion and recursive serialization
  preserve enums, dates, validation issues, reasons, properties and nested results.
- Overview/Calculator now show real selected-date counts and separate historical
  violation evidence. Planner evaluates fixed/max/earliest scenarios and compares
  independent fixed-date proposals without changing actual history. All six
  statuses, historical versus proposed outcomes, limited prefixes and search
  proof flags remain explicit. No result grants travel permission.
- Explicit completeness/countability declarations and ongoing presence through
  the selected check date. No affirmative context defaults in the browser.
  Ongoing history supports actual snapshots, but planning requires a confirmed
  actual exit. No nationality, visa or residence-permit adjudication.
- Startup/loading/error/retry/cancel states; 60-second startup and 30-second
  request limits; bounded pending queue. Revisions/tokens prevent stale results
  and late errors from replacing current inputs/results. Relevant edits clear
  results; language/theme changes preserve them. Focus restoration and live
  completion announcements are retained.
- English/Russian result/reason/issue text with unknown-code fallbacks. Existing
  seven screens, themes, calendar and safe text-node rendering are preserved.
- Memory by default, explicit local-saving consent, strict versioned/size-bounded
  history restoration, disable/delete and storage-error feedback. Only history
  and language/theme are saved; scenarios, results and declarations are not.
  JSON import/export remains deferred to Stage 7.

### Files

New:

- `src/schengenstay/browser.py` — JSON adapter/serializer, no new arithmetic.
- `scripts/build_browser.py`, `web/python/schengenstay.zip` — deterministic static
  source packaging, with a source-equality CI check.
- `web/scripts/python-worker.js`, `pyodide-bridge.js`, `results.js`,
  `integration-i18n.js`, `storage.js` — runtime/transport, result/context UI,
  bilingual explanations and opt-in local storage.
- `tests/test_browser.py`, `tests/browser_cases.py`,
  `tests/frontend/integration.test.mjs`, `tests/frontend/python-browser.mjs` —
  conversion/serialization/property tests, native reference outputs, transport/
  storage tests and real-Pyodide browser parity/workflow checks.

Modified:

- `web/index.html`, `web/styles/main.css`, `web/scripts/app.js`, `components.js`,
  `dates.js`, `i18n.js`, `store.js`, `views.js` — connected UI, explicit context,
  ongoing records, safe relative loading, CSP and responsive result layouts.
- Existing frontend state/browser tests retain their CRUD/accessibility coverage
  while replacing Stage 4-only placeholder expectations with Stage 5 behavior.
- `.github/workflows/ci.yml`, `package.json` — all frontend unit tests, archive
  consistency check and optional integration-test shortcut.
- README.md, ARCHITECTURE.md, CONTRIBUTING.md, ROADMAP.md, docs/FRONTEND.md,
  this record and both `docs/images/overview-*.png` screenshots.

### Verification actually performed

Python 3.12.14, Node 24.19.0, bundled test-only Playwright 1.62.1 and installed
Chrome 155.0.8059.85 were used. No packages were installed. Pyodide assets were
actually downloaded from the pinned distribution. Test servers were temporary,
loopback-only and closed with the test browser. Nothing was publicly deployed.

| Check | Final local result |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q` | 300 passed in 8.02 seconds; includes all 267 pre-existing tests |
| `.\.venv\Scripts\ruff.exe check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found |
| `node --test tests/frontend/*.test.mjs` | 28 passed |
| `node tests/frontend/browser.mjs` | 17 existing interface/responsive/accessibility checks passed |
| `node tests/frontend/python-browser.mjs` | 14 real integration checks, including 18 full-response CPython parity cases, passed |
| `python scripts/build_browser.py --check` | Archive exactly matches current Python source |
| `python scripts/check_docs.py` | 29 local links/anchors and 4 executable API examples passed |
| `git diff --check` | No whitespace errors |

Parity covers every public function and all six statuses: 90/91 days, multi-trip
leap/year boundaries, invalid/duplicate/overlap cases, explicit ongoing stays,
past versus proposed violations, rolling expiry in maximum/earliest searches,
limited history/searches and a 500-record history. UI workflows independently
assert matching counts, first-violation evidence and found dates. Existing
published Commission fixtures continue passing; no new live official comparison
is claimed. One added deterministic Hypothesis property checks 200 ISO-date/JSON
round trips alongside the existing arithmetic properties.

The final integration run measured **2,476 ms** for the first desktop calculation
and **2,366 ms** in a fresh mobile-sized browser context. A new worker completed
all 18 parity cases, including 500 records, in **1,570 ms**. These are local Chrome
observations with ordinary browser/network caching, not benchmark guarantees or
measurements on physical phones. The UI stays available while its worker loads.
The network audit observed only static GET requests with no request bodies, query
travel data or unexpected origins. Offline/CDN blocking and recovery were exercised.

Browser review found a long Russian metric label overflowing at 320px; fixed
minimum grid widths/text wrapping and reran all seven screens in both languages
at 1440/768/390/320px. All six real result types also fit 390/320px in both
languages. Updated empty-first desktop/mobile screenshots were visually inspected.
A test parameter's oversized generated ID initially failed Windows test setup;
short explicit IDs fixed the test harness. No calculation defect was hidden.

### Remaining limitations / stop boundary

Initial runtime loading depends on the pinned CDN and internet access unless
assets happen to be cached; there is no guaranteed offline/PWA installation.
The dependency-free Python package now has a browser-runtime dependency on
Pyodide, but no paid service, account, API key or server is needed. Licensing,
complete transitive tool locking and final release review remain earlier open
items. A document meta CSP cannot replace a worker response-header policy on a
host that supports one; deployment/security-header review is still deferred.

Chrome and mobile-sized viewports were exercised, not Firefox/Safari, physical
phones, throttled mobile networks or screen readers. Browser checks remain local
tooling rather than CI-installed browser jobs. Local results do not establish
that remote CI has run. Calendar markers show entered intervals, not compliance
heatmaps; search outputs are not silently promoted to actual/fixed trips. No
import/export, visa adjudication, final release testing or public deployment.
The remote remained at `398a6769638e6c86a5322ceb2d6f16c65db6296f` before
staging. Reviewed all changed/new files and archive members; a targeted credential
pattern scan found no matches. Only source, synthetic tests, documentation,
empty-state screenshots and the intentional source archive are included.
Stop after the authorized Stage 5 commit/push and wait for review.

## 2026-10-23 — Stage 4 frontend interface

Started from clean `main` and `origin/main` at `9e11198`. Read PRODUCT.md,
ARCHITECTURE.md, CALCULATION_RULES.md, ROADMAP.md, and this record; inspected the
actual Stage 1–3 models, validators, date helpers, public exports, compliance and
planner contracts. The user's current instruction supersedes the earlier roadmap:
Stage 4 is frontend only; Pyodide and optional persistence move to Stage 5.

### Implemented interface and boundaries

Built seven responsive screens: overview, travel history, calculator, travel
planner, calendar, settings, and how-it-works guidance. Functional interactions
include completed-trip and scenario add/edit/remove, confirmation/cancellation,
basic input validation, inclusive overlap feedback, hash navigation, calendar
month/date navigation, English/Russian localization, and light/dark themes.

The workspace starts empty. The trip count reflects only entered records; used
and remaining day values are dashes. Calculator controls explicitly explain that
calculations are unavailable. Scenarios have independent “not evaluated” panels.
Fixed-date proposals are marked tentatively in the calendar; maximum/earliest
search requests do not imply travel dates. No fabricated calculations, JavaScript
90/180 engine, Pyodide, backend, account, persistence, or deployment was added.
The Python calculation package and all existing Python tests are unchanged.

Records and preferences are memory-only; the UI explains that refresh/closure
clears them. No travel data enters URLs, logs, browser storage, or network calls.
The CSP blocks data connections and form submission. Text uses safe DOM text
nodes. Dates, basic chronology, overlaps and bounded form fields are UI feedback,
not legal-scope or compliance decisions. Loading/error calculation components are
prepared and tested for Stage 5 without simulated runtime activity; real startup
failure has an honest error/reload view.

### New and changed files

- Added `web/index.html`, `web/styles/main.css`, and original local SVG assets
  `web/assets/mark.svg` and `web/assets/journey.svg`.
- Added `web/scripts/bootstrap.js`, `app.js`, `views.js`, `components.js`,
  `dom.js`, `store.js`, `dates.js`, and `i18n.js` for startup, routing, screens,
  reusable controls, session records, calendar presentation, and localization.
- Added `tests/frontend/state.test.mjs` and `tests/frontend/browser.mjs`, plus
  a dependency-free `package.json` for ES modules and optional command shortcuts.
- Added `scripts/check_docs.py`, `docs/FRONTEND.md`, and actual empty-state desktop
  and mobile screenshots in `docs/images/`. Screenshots contain no personal data.
- Updated README.md, ARCHITECTURE.md section 16, ROADMAP.md, CONTRIBUTING.md,
  PROGRESS.md, `.gitignore`, and `.github/workflows/ci.yml`. CI now includes Node
  unit/static checks and offline documentation checks alongside Python checks.

### Verification actually performed

Used the existing Python 3.12.14 environment, Node 24.19.0, bundled Playwright
1.62.1 and installed Chrome 155.0.8059.85. No packages were installed and no runtime
dependency was added. Browser checks used a temporary loopback-only static test
server and closed the test browser/server afterward. The standalone initial
sandbox preview could not be reached across the network boundary; the browser
suite runs its test server and browser together with approved local access.

Browser review found and fixed a view-composition syntax error, a dialog focus
boundary, and skip-navigation behavior; an asynchronous native-dialog test needed
an explicit dismissal wait. Added startup-failure handling, date-range feedback,
an unknown-hash regression, and larger supporting text before final verification.
Desktop and mobile screenshots were visually inspected after the final layout.

| Command/check | Final local result |
| --- | --- |
| `.\.venv\Scripts\python.exe -m pytest -q` | All 267 existing tests passed in 7.81 seconds |
| `.\.venv\Scripts\ruff.exe check .` | All checks passed |
| `.\.venv\Scripts\python.exe -m pip check` | No broken requirements found |
| `node --test tests/frontend/state.test.mjs` | 18 tests passed |
| `node tests/frontend/browser.mjs` | 17 browser checks passed |
| `.\.venv\Scripts\python.exe scripts/check_docs.py` | 25 local links/anchors and 3 executable Python examples passed |
| `git diff --check` | No whitespace errors |
| Remote before commit | `origin/main` remained `9e11198bb0f9848e501e72acacbaef212ce2e271` |

Browser checks include CRUD, form errors, text safety, independent scenarios,
no computed counts, unavailable/empty states, calendar markers and keyboard
selection, language/themes, delete cancellation, dialog focus and Escape, startup
failure, zero browser storage/cookies, and absence of remote data requests or
browser errors. All seven screens fit at 1440, 768, 390, and 320 pixels in both
languages. Named controls/landmarks and key text contrast pairs were checked in
both themes. Reduced-motion CSS is included. This is not a full accessibility
audit, screen-reader certification, or real mobile-device verification.

Rechecked the Commission's official calculator guidance page for the plain-language
rule explanation/link. Did not run the live calculator or claim additional engine
parity. Existing published-fixture tests remain unchanged and pass.

### Remaining limitations and Stage 5

This is a frontend preview, not an operational browser calculator. Data and
preferences disappear on refresh. Ongoing-stay input is not supported in this UI.
Chrome was exercised; Firefox, Safari, physical devices, and screen readers still
need review. Native date-input formatting follows browser/OS locale. The optional
Playwright browser suite is not installed or run by CI; local passes do not prove
remote CI success. Licensing and full dependency locking remain earlier decisions.

Stage 5 needs the pinned Pyodide/worker bridge, explicit scope/completeness and
as-of inputs, Python validation, all six result statuses with separate history and
planning evidence, stale-response protection, bounded work, real loading/error
handling, consent-based persistence, and browser/Python parity tests. Detailed
handoff is in docs/FRONTEND.md. Stop after the single Stage 4 commit/push for review.

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
