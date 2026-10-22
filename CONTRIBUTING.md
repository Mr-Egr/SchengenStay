# Contributing

Read the five supplied requirements documents and the Stage 1 decisions in ARCHITECTURE.md
before making changes. Work on one authorized roadmap stage at a time. Stage 1
adds date arithmetic and structured history validation to the Stage 0 scaffold.
Compliance checking, planning, UI, and deployment remain outside this stage.

## Local workflow

1. Use Python 3.12+ and the setup instructions below to create an isolated `.venv`.
2. Install the package and its development extra: `python -m pip install -e ".[dev]"`.
3. Before changing a future algorithm, add tests for its intended behavior.
4. Run `python -m pip check`, `python -m pytest -q`, and `ruff check .` with that
   environment. Record actual commands and results in PROGRESS.md.
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
  provenance for independent fixtures. Stage 1 verifies arithmetic against
  synthetic/manual cases and an independent oracle; it does not establish official
  example parity or legal eligibility. Never relabel synthetic fixtures as official.
- Do not add paid services, runtime dependencies without a concrete need,
  server storage, telemetry, or duplicate calculation logic in JavaScript.

GitHub Actions uses the commands above on Python 3.12. A local pass does not prove
that a remote workflow ran; report these separately. No deployment is configured.


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
Initial installation needs access to the Python package index. Checks themselves
need no network, browser, accounts, API keys, or paid services.

## Dependencies and CI

- Runtime: Python standard library only; no third-party runtime dependencies.
- Build: setuptools, used by pip to install the `src/` package.
- Development: pytest for unit tests, Ruff for linting, and Hypothesis for
  property-based arithmetic tests against an independent date-set oracle.

The three development tools are pinned to the versions verified locally in
`pyproject.toml`; transitive and build dependencies are not fully locked yet.
GitHub Actions runs the same
checks on Python 3.12 for pushes and pull requests. It does not deploy anything.

## File map and verification scope

```text
src/schengenstay/__init__.py    public package import
src/schengenstay/contracts.py  six agreed result statuses
src/schengenstay/models.py     completed/ongoing records and usage snapshots
src/schengenstay/dates.py      parsing, inclusive intervals, unique coverage
src/schengenstay/validation.py structured validation and overlap detection
src/schengenstay/calculator.py validated rolling 180-day usage
tests/test_contracts.py        installation and JSON/status contract checks
tests/test_dates.py            parsing and calendar boundary tests
tests/test_validation.py       malformed, duplicate, overlapping history tests
tests/test_calculator.py       hand-counted snapshot and expiry cases
tests/test_properties.py       independent oracle and invariants
pyproject.toml                packaging, dependencies, pytest and Ruff settings
.github/workflows/ci.yml       automated lint/test checks
.gitignore                    environments, caches and generated files
CONTRIBUTING.md                contribution and stage-boundary guidance
PROGRESS.md                    commands, results and remaining work
```

The original five requirements documents are preserved. Unit tests cover inclusive
boundaries, empty/one-day histories, leap/century years, the 90th/91st day, gradual
expiry, future dates, duplicate coverage, ongoing assumptions, and date extremes.
Seven deterministic property tests each run 200 generated examples. The fixtures
are synthetic/manual arithmetic cases, not official compliance examples.

The [European Commission calculator page](https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en)
was reviewed on 2026-10-22 for the rolling-day principle. Its linked manual URL
returned HTTP 429 during this work. Official example matching and live calculator
comparison remain Stage 2/release work, as do full scope handling, browser tests,
and release gates. No license has been selected; choose one before public
distribution rather than assuming licensing terms on the owner's behalf.

See [PROGRESS.md](PROGRESS.md) for recorded check results. Stage 2 remains the
next implementation stage; agree its scope before starting new features.
