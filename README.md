# SchengenStay

A travel-planning project with a tested Python day-count engine and a responsive
web interface for organizing Schengen trips.

**Current status: Stage 6 — scope and legal-context safeguards implemented.**
The calculator and planner run the real Python package locally through Pyodide.
There is no deployed application.

## The problem

Tracking several trips against a rolling 90-in-180-day window is easy to get
wrong: entry and exit days count, and older days gradually leave the window.
SchengenStay makes those day counts reproducible through a tested Python library.

## Implemented

- Inclusive entry/exit dates and strict date parsing, including leap years and
  calendar boundaries.
- Unique occupied-day counts and arithmetic remaining for a selected date's
  180-day window.
- Validation for malformed dates, duplicate records, and overlapping stays.
- Ongoing-stay calculations using an explicit check date.
- Full-history and fixed-itinerary checks with first-violation dates, counts,
  explanation codes, and separate historical results.
- Bounded maximum-stay and earliest-entry searches, plus independent comparison
  of hypothetical trips without changing actual history.
- Explicit outcomes for invalid input, incomplete information, unsupported scope,
  and bounded inspections.
- Unit and property-based tests, plus a GitHub Actions workflow for automated checks.
- Responsive English/Russian interface with trip editing, tentative scenarios,
  calendar views, and light/dark themes. History saving is local and opt-in.
- Background Python calculations, explicit scope/completeness confirmations,
  translated explanations, and recoverable loading errors.
- Specific blocking results for uncertain or unsupported visa/residence contexts;
  optional visa-date consistency checks, without visa adjudication.

The engine operates on dates already identified as countable short stays. Its
remaining-day figure is a snapshot, not a promise of additional continuous travel.

## Planned

- Further accessibility, cross-browser and release validation.
- Separately authorized JSON import/export and static deployment.

See the [roadmap](ROADMAP.md) for the staged implementation plan.

## Tech stack

**Python 3.12+**, standard-library date arithmetic and immutable data models;
**Pyodide 314.0.7**, **HTML, CSS, and vanilla JavaScript ES modules**; **pytest**, **Hypothesis**, and
**Ruff** for Python checks; Node's built-in frontend tests; **GitHub Actions** for CI.
No frontend framework, bundler, backend, or paid services. The Python library has
no third-party dependencies; the browser downloads the pinned Pyodide runtime.

## Quick start

From the repository root with Python 3.12+ (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\python.exe -m pip check
```

For macOS/Linux setup and contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).
For Python examples, see the [planner API](ARCHITECTURE.md#15-stage-3-travel-planner).

Run the integrated application locally:

```powershell
.\.venv\Scripts\python.exe -m http.server 8765 --bind 127.0.0.1 --directory web
```

Open [localhost:8765](http://127.0.0.1:8765). See the [frontend guide](docs/FRONTEND.md)
for screenshots, checks, loading troubleshooting, and privacy details. Initial
Python loading needs internet access. After editing Python, regenerate its static
archive with `python scripts/build_browser.py`.

## Documentation

- [Product requirements](PRODUCT.md) — intended users, scope, and V1 goals.
- [Calculation rules](CALCULATION_RULES.md) — date semantics and unsupported cases.
- [Context and limitations](docs/LEGAL_CONTEXT.md) — supported questions and official sources.
- [Architecture and API](ARCHITECTURE.md) — current engine details and planned design.
- [Contributing](CONTRIBUTING.md) — setup, checks, dependencies, and project layout.
- [Progress record](PROGRESS.md) — completed work, verification, and open issues.
- [Documentation guide](README_START_HERE.md) — reading order for the original requirements.

## Scope and disclaimer

SchengenStay is informational and is not an official tool. It does not grant
permission to enter or stay, assess visa validity, or resolve residence-permit
and other special legal circumstances. Representative published Commission
examples are covered by tests; live-calculator comparison and broader release
validation remain outstanding.
