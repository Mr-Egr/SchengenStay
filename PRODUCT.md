# SchengenStay — Product Requirements Document

**Status:** approved planning baseline / pre-implementation  
**Version:** 0.1 (2026-10-22)  
**Product:** English/Russian responsive web application for planning standard short stays under the Schengen **90 days in any rolling 180-day period** rule.  
**Development emphasis:** substantial Python code, automated testing, reliable date logic, a publicly demonstrable portfolio product.

## 1. Product promise and limitations

Provide a clear, reproducible answer to: how many **countable short-stay** days appear in the 180-day window ending on a particular date, and whether a proposed continuous short visit would breach the standard 90/180 rule. Show the exact dates, assumptions, and first violating day where applicable.

**Never claim to grant a right of entry, visa validity, or legal stay.** A result of `WITHIN_90_180_RULE` means only that the evaluated itinerary meets the standard rolling-day arithmetic for the **supported case**, not that travel is authorized. Citizenship, visa sticker duration/validity, number of entries, residence permits, national extensions, bilateral agreements, territorial limitations and border decisions can change the legal answer.

## 2. Audience and use cases

- Visa-required and visa-exempt non-EU travelers whose **short stays are subject to the usual Schengen 90/180 calculation**.
- User with multiple completed short trips: enter history and check a date.
- User planning a trip: test arrival/departure dates and locate first violating date.
- User uncertain about specific legal grounds: receive honest `UNSUPPORTED/REVIEW_REQUIRED` guidance instead of a definitive green light.

Not a full immigration status adjudication system. Not an official European Commission tool.

## 3. Scope and priorities

### Must-have for publicly demonstrable V1
1. Mobile-first UI, English/Russian toggle, accessible date controls.
2. Add/edit/delete completed short-stay trip with **inclusive** entry and exit dates.
3. List, sort and validate trip history; overlapping stays are flagged; duplicates not silently double counted.
4. Check mode: select arbitrary check date and display unique countable days within `[date−179, date]`, arithmetic remaining up to 90, and calculation scope.
5. Plan mode: enter arrival/departure and validate **every day** of proposed stay against 90/180; show first violating date and number of days in the relevant 180-day window.
6. Find maximal continuous allowable stay from given entry date, bounded by user-selectable horizon and explicit limit; avoid `90−used_now` shortcut.
7. Find earliest entry date for a desired length within a finite search horizon; show if none found within horizon.
8. Calendar highlighting counted past days, planned days, warnings; text labels in addition to colors.
9. History saved **locally on user's device** only with informed choice; clear/delete and JSON export/import with schema validation.
10. Python calculation package, unit and property tests, CI, deterministic fixtures, documented scope and privacy.
11. The UI differentiates `VALID_FOR_RULE`, `VIOLATION`, `INSUFFICIENT_DATA`, `OUT_OF_SCOPE` and `INVALID_INPUT`.
12. Public static deployment and human-readable README explaining how to reproduce tests.

### After V1, contingent on validation
- Multi-scenario comparison, browser-installable PWA/offline caching, export printable summary, saved itinerary variants.
- Short-stay visa *additional* constraints (sticker date bounds, authorized duration, entry count), only with clear definitions and reviewed tests. Never silently collapse visa validity into 90/180 validity.
- Historical Schengen membership and territory/time-specific rule models, with individually documented effective dates.

### Explicitly out of scope for V1
- Legal determination for visa D, residence permit, pending permit applications, extensions, bilateral waivers or mixed-status stays.
- Travel entitlement decisions, passport/identity storage, accounts, email reminders, hosted personal database, paid APIs, marketing trackers.
- Automatic inference of entry / exit or legal basis from GPS or passport scans.

## 4. Screens and interactions

**Dashboard:** short explanation; read-only used/remaining as-of selected day; recent trip list; planning call-to-action; prominent scope warning.

**History:** trip list with date range and inclusive length; create/edit/delete; country optional **descriptive metadata only** in V1 (not independently assessed for legal geography); sort chronologically; overlapping records are rejected or explicitly resolved as duplicate data.

**Check:** check date; 180-day start/end; used days; remaining-days arithmetic; clear display of `WITHIN_RULE` vs `EXCEEDS_RULE`; links to explanation for counted days. If future recorded trips exist, only dates up to check date contribute.

**Planner:** input desired entry and exit; test daily rolling windows; report earliest violating day; maximum permissible consecutive days (limited computation horizon); earliest feasible entry for a trip of N days; planned travel must not be persisted as actual travel without confirmation.

**Calendar:** month navigation, keyboard support; past short-stay vs planned vs warning legend; descriptive date details in text.

**Help / Scope:** visual explanation of rolling 180-day window; border days included; details on countries, changes over time, long-stay/residence exceptions and other requirements; official links and disclaimer.

**Privacy:** local-only computation, optional local persistence, export/import/erase; explain risks on shared devices and that browser clearing may erase local data.

## 5. UX requirements

- English default, Russian translation available; selected language persists locally if consented.
- ISO `YYYY-MM-DD` for stored data; locale-specific display dates; no timezone-dependent off-by-one errors.
- Clear empty/loading/error states. Pyodide initial load is disclosed and recoverable.
- Responsive down to narrow phone widths, keyboard navigation, meaningful labels, accessible contrast, error messages associated with fields. Avoid color-only warnings.
- Input overlap and unknown legal basis trigger explicit messages; do not silently accept inconsistent data.
- Explain computed **arithmetic remaining on a selected day** separately from **consecutive allowable future stay**.

## 6. Nonfunctional requirements

- Python 3.12-compatible pure calculation core, no network calls; deterministic results.
- Static frontend hosted for free; use pinned Pyodide release and reproducible deployment. Load Pyodide away from main interaction where possible, cache static resources and measure mobile startup performance.
- Treat imported JSON as untrusted: schema/version, field types, range limits, bounded list length, byte-size cap; never execute imported data, sanitize textual notes.
- No automatic telemetry, analytics or remote persistence by default.
- All error paths tested. Versioned algorithms and clear documentation.

## 7. Acceptance criteria

- One-day trip counts as one; 90-day continuous stay passes; 91st consecutive day fails at day 91.
- Every prospective day is checked, not just proposed arrival/departure.
- Reordering input trips cannot change results; duplicate date coverage is not double counted.
- Incorrect, overlapping or unsupported records receive actionable validation feedback.
- Historical and special-status scenarios are either correctly modeled and tested or declared unsupported before a definitive result.
- Baseline results cross-checked against authoritative reference examples and documented.
- English and Russian modes, responsive UI, local state, import/export, tests and public URL work.

## 8. Portfolio outcomes

Demonstrate Python algorithms, date/interval processing, data validation, modular engineering, readable docs, unit/property tests, frontend/Python integration, local data privacy, CI and a finished product. Describe only features actually built and deployed in CV/LinkedIn.

## 9. Sources

- European Commission short-stay calculator: https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en
- Commission calculator user guide: https://home-affairs.ec.europa.eu/document/download/c6b8be91-871c-4e5a-bf11-d260d4488020_en?filename=short_stay_schengen_calculator_user_manual_en.pdf
- Council Schengen membership: https://www.consilium.europa.eu/en/policies/schengen-area/

Sources and rules must be rechecked for material changes before public release. The app does not replace official advice.
