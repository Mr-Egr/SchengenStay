# SchengenStay

A Python project for understanding Schengen short-stay day counts, with a travel
planning web application planned for later development.

**Current status: Stage 2 — Python arithmetic compliance checking implemented.**
There is no web interface, travel-planning search, or deployed application yet.

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
- Explicit outcomes for invalid input, incomplete information, unsupported scope,
  and bounded inspections.
- Unit and property-based tests, plus a GitHub Actions workflow for automated checks.

The engine operates on dates already identified as countable short stays. Its
remaining-day figure is a snapshot, not a promise of additional continuous travel.

## Planned

- Travel planning: maximum continuous stay and earliest entry searches.
- An English/Russian browser interface using Pyodide, optional local storage,
  and static deployment.

See the [roadmap](ROADMAP.md) for the staged implementation plan.

## Tech stack

**Python 3.12+**, standard-library date arithmetic and immutable data models;
**pytest**, **Hypothesis**, and **Ruff** for testing and linting; **GitHub Actions**
for CI. The current engine has no third-party runtime dependencies or paid services.

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
For Python examples, see the [compliance API](ARCHITECTURE.md#14-stage-2-compliance-contract).

## Documentation

- [Product requirements](PRODUCT.md) — intended users, scope, and V1 goals.
- [Calculation rules](CALCULATION_RULES.md) — date semantics and unsupported cases.
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
