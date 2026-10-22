# Contributing

Read the five supplied requirements documents and the Stage 1 decisions in ARCHITECTURE.md
before making changes. Work on one authorized roadmap stage at a time. Stage 4
introduced the frontend; Stage 5 connects the same Stage 1–3 package through
a pinned Pyodide worker and adds opt-in history saving. Do not add JavaScript
calculation logic. See ARCHITECTURE.md sections 14–17 and the
[frontend guide](docs/FRONTEND.md) for contracts, local preview, and browser checks.

## Local workflow

1. Use Python 3.12+ and the setup instructions below to create an isolated `.venv`.
2. Install the package and its development extra: `python -m pip install -e ".[dev]"`.
3. Before changing a future algorithm, add tests for its intended behavior.
4. Run `python -m pip check`, `python -m pytest -q`, and `ruff check .` with that
   environment. Also run `node --test tests/frontend/*.test.mjs` with Node 22+
   and `python scripts/check_docs.py`. Regenerate the committed Python archive after
   source edits with `python scripts/build_browser.py`; verify it with `--check`.
   Run both browser suites in the frontend guide for integration changes.
   Record actual results in PROGRESS.md.
5. Summarize changed behavior, relevant tests, limitations, and the next stage.
   Stop at the authorized stage boundary.

Use `src/schengenstay/` for Python code and `tests/` for checks. Keep pure-Python
tests independent of networks and browsers. Do not add test path overrides to
hide installation problems. Keep the independent date-set oracle separate from
production interval operations. Hypothesis properties use deterministic runs;
add any discovered regression as a concrete unit test as well.

## Contract and safety of results

- Use the six `ResultStatus` codes documented in ARCHITECTURE.md, section 13. Contract changes
  require explicit documentation and matching tests.
- Never expose a travel-permission verdict. Unsupported or incomplete legal
  context must be identified before a definitive result is presented.
- Keep calendar arithmetic timezone-independent, horizons finite, and planned
  visits separate from actual history.
- Use synthetic examples in tests; do not commit personal travel or identity data.
- Consult the official sources linked in CALCULATION_RULES.md and record
  provenance for independent fixtures. Stage 2 includes six published Commission
  arithmetic examples and separately labeled derived boundary cases. This is not
  exhaustive official parity or legal eligibility. Never relabel synthetic or
  derived expectations as published official outcomes.
- Do not add paid services, runtime dependencies without a concrete need,
  server storage, telemetry, or duplicate calculation logic in JavaScript.

GitHub Actions uses the commands above on both Ubuntu and Windows with Python
3.12 and Node 22. Browser checks
are separate optional local checks using Playwright; see the frontend guide.
A local pass does not prove that a remote workflow ran; report these separately.
No deployment is configured.


## Environment setup

Use Python **3.12 or newer**. Confirm `python --version` before creating the
environment; Python 3.9 is not supported. If `python` points to an older version,
use a Python 3.12+ executable or `py -3.12` for the environment creation command.

PowerShell, from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\ruff.exe check .
```

No activation or PowerShell execution-policy change is required. On macOS/Linux:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -e ".[dev]"
.venv/bin/python -m pip check
.venv/bin/python -m pytest -q
.venv/bin/ruff check .
```

With an activated environment, the checks are `python -m pytest -q` and
`ruff check .`. Tests import the installed package; install it before testing.
Initial installation needs access to the Python package index. Python and Node
unit checks run offline. The optional real-Pyodide integration suite needs a browser
and initial runtime downloads; it needs no account, API key, or paid service.

## Dependencies and CI

- Python library runtime: standard library only.
- Browser runtime: Pyodide 314.0.7 from its pinned jsDelivr distribution. No npm
  runtime package installation; see docs/FRONTEND.md for asset loading and limits.
- Build: setuptools, used by pip to install the `src/` package.
- Development: pytest for unit tests, Ruff for linting, and Hypothesis for
  property-based arithmetic tests against an independent date-set oracle.

The three development tools are pinned to the versions verified locally in
`pyproject.toml`; transitive and build dependencies are not fully locked yet.
GitHub Actions runs the same checks on both operating systems for pushes and pull
requests. The browser source archive uses canonical metadata and uncompressed ZIP
entries, so the byte-for-byte source check is independent of the build host and
zlib version. Archive tests cover Windows/Linux/macOS metadata defaults and LF/CRLF
checkouts. Do not regenerate it during CI to hide a stale committed artifact.
No checks are skipped or downgraded, and CI does not deploy anything.

## File map and verification scope

```text
src/schengenstay/__init__.py    public package import
src/schengenstay/contracts.py  six agreed result statuses
src/schengenstay/models.py     completed/ongoing records and usage snapshots
src/schengenstay/dates.py      parsing, inclusive intervals, unique coverage
src/schengenstay/validation.py structured validation and overlap detection
src/schengenstay/calculator.py validated rolling 180-day usage
src/schengenstay/compliance.py history and fixed-itinerary checks/results
src/schengenstay/explanations.py scope declarations, reasons, and disclaimer
src/schengenstay/planner.py    bounded searches and independent scenario results
tests/test_contracts.py        installation and JSON/status contract checks
tests/test_dates.py            parsing and calendar boundary tests
tests/test_validation.py       malformed, duplicate, overlapping history tests
tests/test_calculator.py       hand-counted snapshot and expiry cases
tests/test_properties.py       independent oracle and invariants
tests/test_compliance.py       Stage 2 history, itinerary, status, and limit tests
tests/test_compliance_properties.py independent daily/budget compliance oracle
tests/test_planner.py          search boundaries, statuses, limits, and scenarios
tests/test_planner_properties.py independent exhaustive-search oracle and invariants
tests/test_official_examples.py published examples and derived boundary tests
tests/fixtures/official_examples.json source provenance and fixed arithmetic cases
pyproject.toml                packaging, dependencies, pytest and Ruff settings
.github/workflows/ci.yml       automated lint/test checks
.gitignore                    environments, caches and generated files
CONTRIBUTING.md                contribution and stage-boundary guidance
PROGRESS.md                    commands, results and remaining work
```

The original five requirements documents are preserved. Unit tests cover inclusive
boundaries, empty/one-day histories, leap/century years, the 90th/91st day, gradual
expiry, future dates, duplicate coverage, ongoing assumptions, and date extremes.
Sixteen deterministic property tests each run 200 passing generated examples,
including the Stage 5 ISO/JSON round trip.
Synthetic/manual fixtures remain separate from the published example fixture,
which records source, retrieval date, pages, and the distinction between stated
examples and derived boundary expectations. Python and Node unit tests run offline; real browser integration loads Pyodide.

The [European Commission calculator page](https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en)
was reviewed on 2026-10-22 for the rolling-day principle. The original manual URL
failed during earlier work and returned HTTP 404 in Stage 2; an accessible official
copy supplied the six cases now tested. See CALCULATION_RULES.md section 10 for
the source. Live calculator comparison, broader reference coverage, cross-browser/physical
device review, and release gates remain open. No license has been selected; choose one before public
distribution rather than assuming licensing terms on the owner's behalf.

See [PROGRESS.md](PROGRESS.md) for recorded check results. Stage 5 stops for review;
subsequent stages require separate authorization.
