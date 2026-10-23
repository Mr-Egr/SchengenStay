# Stage 7 release-readiness record

**Stage 8 update:** the owner has now approved MIT licensing (2026 Egor Kibishev)
and public GitHub Pages release. LICENSE and package notices resolve the license
decision below. The Stage 7 evidence is preserved as a historical record;
[Stage 8 publication evidence](DEPLOYMENT.md) records the subsequent gates.

Reviewed 23 October 2026, starting at `85a0252`. This is a QA record, not a
deployment approval, legal certification or guarantee of error-free software.
Stages 0–6 source, contracts, browser state, worker, storage and existing tests
were inspected. The rolling arithmetic and planner algorithms were not changed.

## Verdict and checklist

**Technical QA passes in the tested environments. Public distribution remains
blocked by the owner's unresolved project-license decision.** Review the warnings
below and the eventual hosting configuration before separately authorizing Stage 8.

| Classification | Gate | Evidence / action |
| --- | --- | --- |
| PASS | Rolling arithmetic and bounded planning | Existing independent set-oracle properties, leap/century/calendar bounds, inclusive 90/91 days, ongoing assumptions, overlapping records, historical violations, expiry and bounded searches pass. |
| PASS | Independent official reference | Six published arithmetic examples reread; 12 live synthetic comparisons matched. Exact scope below. |
| PASS | Complete user journey and scope gates | Add, confirm, calculate, plan, edit, reconfirm, recalculate and remove; all six statuses; unsupported/unknown contexts never become positive results. |
| PASS | Date input and responsive UI | EN/RU, both themes, seven screens, keyboard date editing and picker, desktop/tablet/phone-sized layouts; actual clipboard paste in Chrome and Edge. |
| PASS | Privacy and input boundaries | Opt-in saving/deletion, corruption rejection, text-only rendering, unknown fields, size/count limits, no travel data in observed network requests. Duplicate JSON names now rejected. |
| PASS | Worker recovery | Cancellation, obsolete errors, stale responses, message-send failure, missing assets, startup timeout, retry and repeated requests tested. |
| PASS | Package and archive | Isolated wheel build inspected: all 11 package modules match source, no extra package files/runtime requirements; deterministic browser archive equals source. |
| PASS | Local quality checks | Python/Hypothesis, frontend, real-browser/parity, Ruff, pip consistency and documentation checks pass; see PROGRESS.md for totals. |
| PASS | CI configuration | Existing Ubuntu/Windows checks retained; both now also run Chromium UI and real Python integration suites. Post-push run conclusions are verified in delivery, not inferred from local passes. |
| WARNING | Apple Safari, physical hardware and assistive technology | Windows Playwright WebKit is not Safari on macOS/iOS. No physical-device or screen-reader testing; no WCAG conformance claim. |
| WARNING | Startup/network/performance | Cold cache/CPU/network guarantees are untested. Firefox is slower at the history limit. Startup needs CDN access unless cached; no promised offline reload/PWA. |
| WARNING | Supply chain and hosting | Pyodide is version-pinned, not self-hosted/integrity-verified here. Worker response CSP and hosting headers require Stage 8 review. Build/transitive tools are not fully locked; pip consistency is not a vulnerability scan. |
| WARNING | Legal interpretation | User-declared history/countability cannot be verified; visa, residence and nationality adjudication remain unsupported. Source examples do not prove every itinerary or national rule. |
| BLOCKER | Project licensing | No project LICENSE or license grant exists. Owner must choose terms before this project's public-distribution gate is cleared; none was invented. See attribution inventory. |

## Reproducible defects fixed

| Severity | Defect and consequence | Fix / regression |
| --- | --- | --- |
| Medium | A terminated worker's late error could terminate its replacement; cancellation between readiness and dispatch could forward old work to the new worker. The result-revision guard already prevented obsolete UI publication. | Bind request/error handling to the worker instance; transport unit regressions first failed, then passed; actual cancellation/restart also tested in browsers. |
| Medium | A failed `postMessage` left a pending timer/queue entry, risking a later unrelated runtime reset. | Clear/terminate through the normal failure path and expose the existing translated calculation error. Regression verifies empty queue. |
| Medium | Editing inspection budget left results/metrics visible until blur. | Invalidate on input without replacing the active control; real-browser regression reproduced the old result before the fix. |
| Medium | Duplicate raw JSON keys silently selected the last value, allowing an unknown/incomplete declaration to be overwritten. The normal UI does not generate duplicate keys. | Reject duplicate names at every object depth as `INVALID_INPUT` with field `json`; three failing regressions and a 300-example malformed-input property. |
| Low | Installed package description still described a scaffold. | Updated description to implemented arithmetic/planning; built wheel metadata inspected. |
| Low | CI Chromium exposed a test race: immediate dialog-count assertions ran before its queued close event removed the element. | Reproduced with pinned Chromium 151; successful save/cancel/remove paths await DOM removal, retaining every assertion and invalid-input check. |

No reproducible critical/high-severity arithmetic or UI defect remains from this
audit. This is the result of the described checks, not an exhaustive security audit.
No tests were disabled, skipped or weakened. Firefox's failed-download test wait
was corrected from 30 to 90 seconds to observe the existing 60-second startup
timeout. The application timeouts were not increased.

## Calculation verification evidence

Sources opened on 23 October 2026:

- [Commission calculator guidance](https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en).
- [Commission manual](https://ec.europa.eu/assets/home/visa-calculator/docs/short_stay_schengen_calculator_user_manual_en.pdf), section 6, printed pages 5–7.
- [Live calculator linked by the Commission](https://ec.europa.eu/assets/home/visa-calculator-2/calculator.htm).

The existing published fixture's two snapshots and four durations match the
manual reread. Next-day failures and earliest-entry expectations remain explicitly
derived tests, not additional quoted official examples. Nationality exceptions
mentioned elsewhere in the manual were not implemented or independently adjudicated.

The live form was operated in Chrome with synthetic standard countable dates.
Each date and selected mode was read back before calculation. Date widgets needed
initialization and blur before adding rows; early automation attempts that lost a
field or hit a date-picker overlay were rejected, not counted as comparisons.
The completed run accepted all twelve cases without changing the official code.

| Live mode | Inputs / observed arithmetic | Matched |
| --- | --- | --- |
| Planning, four cases | History 1–10 Jan, 1–30 Mar, 1 May–9 Jun 2024; arrivals 19 Jun, 7 Aug, 8 Aug, 8 Sep | Maximum consecutive lengths 20, 20, 50, 90 |
| Control, two cases | 1 Jan–30 Mar 2024; 1 Jan–31 Mar 2024 | Within rule on day 90; 91 days / first violation 31 Mar / window starts 4 Oct 2023 |
| Control, leap/year boundaries | 28 Feb–1 Mar 2024; 30 Dec 2023–2 Jan 2024 | Within rule; continuation exits 27 May and 28 Mar respectively |
| Control, rolling boundary | One-day 1 Jan 2024 history; checks 28 and 29 Jun | Within rule; continuation exits 25 and 26 Sep respectively |
| Control, two published snapshots | One-day 1 Jan plus 1 Jun through 14 Jun / 29 Aug 2024 | Within rule; 14 Jun continuation exit 29 Aug; 29 Aug reports no further days on that date |

The ordinary compliant Control output does **not** display used days; those counts
were not invented as live observations. Comparison asserts only the observed
verdict, violation evidence where shown, and continuation end where shown.
Continuation begins after an occupied check date or on an unoccupied check date.
For an ongoing stay the manual's explicit through-date exit represents the same
counted dates as our `OngoingStay` plus confirmed `as_of`; it is not an actual exit.
No visa validity, entry rights, historical membership or special residence case
was submitted as an equivalent standard calculation.

Exact ISO inputs and transcribed numeric fields:
[live fixture](../tests/fixtures/official_live_2026-10-23.json), tested by
[offline regressions](../tests/test_official_live.py). Rerunning those tests does
not establish a fresh live comparison. The full six-status JSON contract and
search-limit statuses are SchengenStay contracts, not claimed official API parity.

## Browser, accessibility and reliability coverage

Windows host, Playwright 1.62.1, Node 24.19.0, native Python 3.12.14:

| Browser | Coverage |
| --- | --- |
| Installed Chrome 155.0.8059.85 | Full 26-check interface/date/accessibility suite; 23 integration/release groups; 99 native-Python/Pyodide comparisons |
| Installed Edge 155.0.4283.62 | Same interface and integration suites; Chromium engine, not a separate rendering architecture |
| Playwright Firefox 153.0 | 23 integration/release groups and 99 parity comparisons; full seven-screen responsive and keyboard/date journeys |
| Playwright WebKit 26.5 on Windows | Same integration/release groups/parity; does not establish Safari/iOS behavior |

Viewports: 1440px desktop, 768px tablet, 390px and 320px phones. Both languages
and themes, native dialog focus containment/restoration, field labels, error/live
announcements, base text contrast, visible/forced-color focus, date keyboard
navigation, picker selection, impossible dates and state retention were tested.
Chrome/Edge additionally exercise real OS clipboard paste; that clipboard check
was not claimed on Firefox/WebKit. Automated checks do not replace assistive-
technology or physical touch testing. No physical device was used.

Failure tests cover blocked CDN loads, missing modules/worker asset, retry, delayed
archive response while editing, cancellation, stale completions and failures,
queue/timeout bounds, repeated requests, corrupted/denied storage, deletion and
reload. Already initialized workers calculate with browser networking disabled.
This is not a measured slow-cellular-bandwidth or cold-cache offline guarantee.

## Observed performance

One representative local run per engine; milliseconds, no simulated mobile CPU.
First calculation includes initialization and UI; worker start is a separate new
worker in the parity test. Network and OS caches may be warm. Rounded values:

| Measurement | Chrome | Edge | Firefox | WebKit |
| --- | ---: | ---: | ---: | ---: |
| First desktop calculation | 1985 | 2487 | 11586 | 3125 |
| First mobile-viewport calculation | 2370 | 2353 | 11093 | 2459 |
| Separate worker initialization | 1552 | 1459 | 11458 | 2198 |
| Warm requests, median / p95 across 99 cases | 0.4 / 3.8 | 0.4 / 5.5 | 3 / 44 | 15 / 16 |
| 500 one-day records | 56 | 56 | 473 | 68 |
| 500 records / 10,000 occupied days | 962 | 954 | 8635 | 1109 |
| Earliest search with 10,000-day configured horizon | 5 | 5 | 67 | 8 |
| 100 independent scenarios with small history | 30 | 30 | 368 | 39 |

The long-horizon case finds a result before exhausting its horizon; it does not
claim 10,000 candidate evaluations. The stress history spans centuries to reach
the computational limit, not a legally supported historical geography scenario.
The planner's bounded early termination is intentional. The heaviest combined
100-scenario/10,000-history-day request may reach the 30-second transport timeout;
it is not guaranteed to complete on every device. No speculative core rewrite
was made: the measured history case completes within the timeout, off the UI thread.

## Privacy, security and attribution audit

User text enters DOM text nodes. No `innerHTML`, user-generated Python source,
dynamic code evaluation, travel URL parameters, account, database or telemetry was
found. Observed calculation network traffic is static GET assets only. The CDN
still receives ordinary network metadata such as IP address when assets load;
"local calculation" does not mean zero network contact. CSP restricts document
sources, but a separately served worker needs a hosting response-header review.

Storage remains versioned, opt-in, bounded and atomically validated; disabling
saving removes only this app's key. Context, visa dates, proposals and results
are not persisted. Failed deletion is surfaced, not reported as success. Saved
labels/notes remain user-controlled text. This is not encrypted storage.

Candidate tracked files were reviewed and scanned for common GitHub/AWS/Slack
tokens, private-key headers and credential assignments, with no matches. Source
archive and empty-state screenshots are intentional artifacts. Test histories
are synthetic; local caches, downloaded test browsers, wheels, logs and temporary
reference captures remain ignored. Pattern scanning is not proof against every
possible secret and is not a repository-wide historical forensic audit.

Attribution inventory:

- Local SVG mark, journey illustration and icon paths were created in this
  repository; no external image/font downloads or official EU branding. System
  fonts are referenced, not bundled. Existing screenshots show empty synthetic UI.
- The Python package itself has no third-party runtime dependencies. Its ZIP
  contains only the 11 project modules, not CPython or Pyodide.
- Browser runtime is unmodified Pyodide **314.0.7**, downloaded from its pinned
  CDN path. The [exact upstream project license](https://raw.githubusercontent.com/pyodide/pyodide/314.0.7/LICENSE)
  is **MPL 2.0**; this must not be replaced with a guessed license based on an older
  release. [Pinned source](https://github.com/pyodide/pyodide/tree/314.0.7) is available.
- CPython and incorporated runtime components have their own terms; see
  [Python licenses and acknowledgements](https://docs.python.org/3.14/license.html).
  The Pyodide project license is not a blanket license for every incorporated
  component. Before publishing or self-hosting runtime files, retain the notices
  and source availability appropriate to the exact assets actually distributed.
- Playwright 1.62.1 is test-only, under its
  [Apache 2.0 license](https://github.com/microsoft/playwright/blob/v1.62.1/LICENSE).
  Browser binaries, Node, pytest, Hypothesis, Ruff and build tools are not website
  assets. No commercial/paid service or new application dependency was introduced.

The project-owner license remains the unresolved distribution gate. No license
choice, repository-visibility change, public site, deployment configuration or
commercial feature was introduced in Stage 7.
