# Contributing

Read the five supplied requirements documents and the decisions in README.md
before making changes. Work on one authorized roadmap stage at a time. Stage 1
adds date arithmetic and structured history validation to the Stage 0 scaffold.
Compliance checking, planning, UI, and deployment remain outside this stage.

## Local workflow

1. Use Python 3.12+ and follow README.md to create an isolated `.venv`.
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

- Use the six `ResultStatus` codes documented in README.md. Contract changes
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
