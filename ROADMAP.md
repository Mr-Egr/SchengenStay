# SchengenStay — Codex Implementation Roadmap

**Policy:** work sequentially, do not invent milestones measured in days; prioritize verified correctness over speed. Each stage ends with passing tests and a clear summary before proceeding. No paid infrastructure; use a static site with real Python calculation code running client-side.

## Stage 0 — Repo and contract

**Tasks:** initialize repo + `pyproject.toml`, lint/test tooling, read all four specification docs, establish agreed statuses, supported scope, contributor docs, CI. Write the initial design decisions in README.

**Done when:** `python -m pytest -q` and `ruff check .` run; no failing checks; V1 cannot be mistakenly described as legal authorization.

## Stage 1 — Pure Python date engine

**Tasks:** dataclass models; ISO parser; inclusive interval lengths; date validation; unique counted-days arithmetic; normalized interval abstraction; moving `[D−179, D]` count.

**Done when:** empty, one-day, leap day, new year, 90/91 consecutive days and boundary tests pass. Overlaps produce explicit validation issue.

## Stage 2 — Compliance and explanation

**Tasks:** history check on arbitrary date, daily prospective-itinerary checks, first violating date/count, correct status codes; explain source window and assumptions. Historical violations distinguished from proposed itinerary violations.

**Done when:** independently computed fixtures and EC manual examples matched for supported scenarios; all tests green. Unsupported grounds do not yield an affirmative travel verdict.

## Stage 3 — Planning algorithms

**Tasks:** maximum continuous days from chosen entry; earliest entry for fixed trip length; support explicitly bounded horizons and performance limits. Implement reference algorithm first, optimize only with comparison tests.

**Done when:** all planning tests pass, including windows losing old days, no feasible arrival within horizon, and infeasible initial proposed arrivals.

**Implemented scope:** maximum-stay and earliest-entry searches, with bounded
inspection work and structured results. The user's Stage 3 request also brings
pure-Python comparison of independent hypothetical trips forward from Stage 9;
comparison UI and saved scenarios remain deferred. See ARCHITECTURE.md section 15
and PROGRESS.md for exact contracts and verification results.

## Stage 4 — Browser + Python bridge

**Tasks:** pin Pyodide version; load locally packaged pure Python core in browser; implement fixed JSON API; error/loading states; no user code execution. Use Web Worker if supported and stable.

**Done when:** representative check request in browser yields same structured result as `pytest` reference; unsupported schema is rejected.

## Stage 5 — History and dashboard UI

**Tasks:** responsive shell with English/Russian toggle; trip add/edit/delete/sort; overlap warnings; dashboard results and readable 180-day explanation; accessible date inputs.

**Done when:** desktop and mobile flows work, negative cases handled, no calculated result is shown when history is invalid/unsupported.

## Stage 6 — Planner and calendar UI

**Tasks:** plan forms, validation, violation explanations, maximum-day/earliest-entry search, month calendar with textual legend, planned vs confirmed separation.

**Done when:** test plan can be created, modified and deleted without changing actual history; results match Python API, keyboard navigation works.

## Stage 7 — Local persistence and privacy

**Tasks:** consent for local saving; strict versioned JSON import/export; delete all; size/count constraints; privacy/limitations page.

**Done when:** export->clear->import roundtrip is accurate, bad files rejected, no history transmitted to remote servers.

## Stage 8 — QA, official cross-check and release

**Tasks:** broaden unit/property/regression tests, cross-check the supported examples with EC reference; test interface iPhone/Android/desktop; audit accessibility; check browser performance; deploy free static hosting; finish README and product screenshots.

**Done when:** CI green, public URL verified, no misleading 'legal permission' claims, tested use cases documented, release tagged.

## Stage 9 — Optional features, only after V1

- Historical territory membership with effective dates and provenance.
- Separately validated short-stay visa sticker constraints.
- Multiple planned scenarios / comparison view.
- PWA offline caching and printable PDF report.
- Never add automated pending-residence / D-visa claims without independently reviewed legal specifications.

## Codex execution instructions

1. Read `PRODUCT.md`, `CALCULATION_RULES.md`, `ARCHITECTURE.md`, `ROADMAP.md` **in full before changing code**.
2. Summarize assumptions and any contradictions; apply stricter interpretation where a result could affect travelers.
3. Implement one stage at a time; user does not want a fixed time budget or artificial deadline.
4. Before changing an algorithm, create tests that capture the intended behavior.
5. No invented external APIs, paid services, user accounts or unnecessary databases.
6. Keep business logic in Python, not duplicated in JavaScript.
7. Record commands and test results in progress notes. Never claim tests passed unless run.
8. Use real official sources for legal rules, not model guesses; if rule unclear, return `OUT_OF_SCOPE` and flag for user review.
9. Do not implement or publish specific immigration advice for residence permits, pending applications or visa validity without reviewed scope.
10. At every stage report: files changed, tests run and outcomes, unresolved risks, proposed next stage.

## First message to Codex (copy-paste)

> You are implementing the SchengenStay Python portfolio project. Read the four supplied Markdown specification files fully. Start with Stage 0 and Stage 1 only. Build a clean Python package and comprehensive tests for inclusive calendar day intervals and the rolling 90/180-day counting algorithm. Do not build the full UI yet. Treat the project strictly as a standard short-stay day-rule calculator, not as legal travel advice. Do not make assumptions about visas, residence permits, or national extensions. Show the tests you actually ran and any unresolved issues. After Stage 1, summarize completed work and stop for review.
