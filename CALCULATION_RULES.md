# SchengenStay — Calculation Rules and Edge-Case Specification

**Scope:** standard short-stay arithmetic under the rolling **90-in-any-180-days** rule, **not** a decision about the legal right to travel or remain. Any exception not explicitly modeled must produce an informative `OUT_OF_SCOPE` or `INSUFFICIENT_DATA` result.

## 1. Primary rule

For **every** calendar day `d` in a countable short stay, consider the inclusive date range `[d - 179 days, d]` (180 calendar days). Count all unique days of **countable short stay** in that range. The arithmetic requirement is `count <= 90` on **every** day of a proposed stay.

- Day of entry **counts**.
- Day of exit **counts**.
- Entire Schengen region uses a **shared** 90-day allowance; changing Schengen countries does not independently reset the count.
- `180 days` means 180 **calendar days**, not six calendar months.
- The window moves each day; days gradually expire from the back of the window.
- Simply subtracting current usage from 90 does **not** determine the maximum continuous stay of a future itinerary.

## 2. Dates, precision and semantics

- Python `datetime.date` only; never convert to UTC timestamps for calendar arithmetic.
- Internal ISO date storage `YYYY-MM-DD`.
- One trip `start`, `end` covers the closed interval `[start, end]`; inclusive length = `(end-start).days+1`.
- Completed history intervals must not be overlapping without user resolution; detect overlapping **as an input validation issue**, not merely silently add counts. The arithmetic core deduplicates any repeated date as an additional safety measure.
- One-day trips are valid; end before start invalid; 29 February, leap years, year boundaries and end-of-month must work.
- Distinguish a completed stay from an ongoing stay. For an ongoing stay, require an explicit as-of/check date and indicate assumed coverage through that day; do not make up an exit date.
- Planned itinerary is kept separate from completed history.

## 3. Core algorithm

For a check date D and set `S` of countable short-stay dates:

`start = D - timedelta(days=179)`

`used(D) = |{x ∈ S : start <= x <= D}|`

`remaining_arithmetic(D) = max(0, 90 - used(D))`

For proposed stay `[a,b]`: form `S_proposed = S ∪ {all dates a..b}`; for each day `d` from a to b inclusive, calculate `used_proposed(d)` and declare failure if any `>90`. Return first violation date and count on that date; report successful compliance with the **general rule only** otherwise.

**Past violations:** a proposed trip test cannot erase historical overstay. If historical entries contain days violating the rule, report historical status separately; do not imply a future valid itinerary cures the past.

**Remaining days:** at `D`, remaining arithmetic is a snapshot, not a travel entitlement or a promise of `remaining_arithmetic(D)` more continuous days.

## 4. Planned stay optimizations

- Naïve correct implementation with unique `date` sets is acceptable for initial test fixtures.
- For performant larger histories, create normalized non-overlapping sorted intervals and count intersection lengths with `[D−179, D]`, or use prefix-sum occupancy over a bounded span. Verify optimized logic against naïve reference implementation.
- `max_continuous_stay(arrival, horizon)` simulates day by day until first invalid day. Explicitly return horizon-limited status if no failure within horizon; never claim 'unlimited'.
- `earliest_entry_for_length(length, search_start, search_horizon)` tests each arrival candidate and every day of that trip. Return candidate, or `NOT_FOUND_WITHIN_HORIZON`.
- Validate `length >= 1`, positive horizons, sensible max iterations and finite supported calendar date ranges.

Stage 3 implements these searches plus independent fixed-trip scenario comparison.
See [the planner contract](ARCHITECTURE.md#15-stage-3-travel-planner) for inclusive
horizons, the shared candidate-inspection budget, structured prefix/proof fields,
and the distinction between a bounded search failure and a provably impossible
continuous length over 90. Historical violations remain separate and visible.

## 5. Country and scope limitations

- Country tags are **descriptive only** in V1. V1 supports entries already identified by user as **countable short-stay days in Schengen**.
- When a user supplies trips in countries whose Schengen membership depends on date, do **not** infer that all historic dates count merely because a country is a present-day member.
- Current Schengen includes 29 countries; Bulgaria and Romania completed accession January 1, 2025; historic transitions need a formally tested effective-date model if introduced.
- Days spent in Cyprus or Ireland are not general Schengen short-stay days under present rules; avoid blanket assumptions for historical dates.
- Transfers inside Schengen count as continuous presence for shared rolling-days purposes.

## 6. Status, visa and legal caveats

- Periods authorized under a **residence permit or long-stay (D) visa** are generally not included as ordinary countable short stays for the standard calculator; complex mixed periods require correct territorial/legal context and cannot simply be toggled off without determining which days qualify.
- Pending residence applications, national extensions, visa-free special exemptions, bilateral regimes, and other unusual circumstances must be labeled `OUT_OF_SCOPE` until independently specified and verified.
- For C visas, a pass on rolling 90/180 does **not** certify sticker validity, authorized duration, number of entries or territorial limitations. V1 should **not** give a combined 'travel allowed' status.
- Visa validity and allowed days are separate restrictions; a visa showing under 90 allowed days requires that separate restriction to be verified. Do not infer travel permission from 90/180 calculation.
- No passport/identity data requested.
- Results UI must include: `Calculation checks only the standard rolling 90/180 short-stay rule; it is not permission to enter or stay.`

## 7. Result contract

Stage 6's optional context gate does not change any day-count rule. Unknown
countability blocks arithmetic; specified unsupported questions return
`OUT_OF_SCOPE` without excluding or exempting dates. Optional visa-date validation
checks real dates and their order only; it cannot establish visa validity or
permission to travel. Entry/duration limits remain unsupported.
See [Stage 6 source register and boundaries](docs/LEGAL_CONTEXT.md).

Return typed data (no magic `True/False` only):

- `status`: `WITHIN_RULE | VIOLATION | INVALID_INPUT | INSUFFICIENT_DATA | OUT_OF_SCOPE | HORIZON_LIMIT`
- `check_date` (optional), `window_start`, `window_end`, `used_days`, `remaining_days` (only when meaningful)
- `first_violation_date` / `violation_count` (if violated)
- `inspected_dates` / `search_horizon_end` where relevant
- `scope_notes`, `warnings`, `human_explanation_keys`

Use explicit error reasons that are easy to translate.

## 8. Tests: minimum concrete cases

1. Empty history, checking D: 0 used, 90 arithmetic remaining.
2. Same-day entry/exit: 1 occupied day.
3. 90 consecutive days: every included day <=90.
4. 91 consecutive days: first violation on day 91.
5. Two separate countable stays whose overlap with a 180-day window totals 90: pass.
6. Equivalent stays totaling 91 in a window: fail on first day reaching 91.
7. 90 uninterrupted days outside the area: historical stay can expire from rolling windows; verify the actual dates day by day rather than hard-coded reset logic.
8. Window boundary exactly D−179 included; D−180 excluded.
9. Calendar dates around Feb 29 and Jan 1.
10. History order permutations produce identical output.
11. Overlap/duplicate in user input results in explicit validation issue; low-level occupancy count remains unique.
12. Proposed trip crossing historical-window expiry correctly reflects decreasing older usage.
13. Entry later than exit fails validation.
14. Ongoing stay calculations correctly end at explicit as-of date.
15. Earlier future plans do not change historical past as-of results.
16. Historical 91-day violation is surfaced independently of a later travel plan.
17. `max_continuous_stay` cannot run indefinitely; finite upper bound and bounded status.
18. `earliest_entry_for_length` returns horizon-limited result rather than 'never' if no entry in horizon.
19. Incompatible status or unknown legal context does not yield 'allowed'.
20. Visa/date check is separate from rolling-day evaluation.

## 9. Quality validation

- Unit tests against independently calculated manual fixtures.
- Compare supported scenarios with examples in the European Commission calculator user manual and live official calculator where practical; document the comparison and differences without copying external UI or code.
- Property-based tests: permutation invariant; unique-day count <=180; equivalent normalized histories same output; correctly bounded date sets; add previously unoccupied counted day inside a fixed window increases used count by one.
- CI required. Do not mark release ready until critical cases pass and any ambiguous legal input is explicitly identified.

## 10. Official reference URLs

- https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en
- https://home-affairs.ec.europa.eu/document/download/c6b8be91-871c-4e5a-bf11-d260d4488020_en?filename=short_stay_schengen_calculator_user_manual_en.pdf
- https://www.consilium.europa.eu/en/policies/schengen-area/

### Stage 2 reference verification (2026-10-22)

The document/download manual URL above returned HTTP 404 during Stage 2 work.
An accessible [Commission-hosted manual](https://ec.europa.eu/assets/home/visa-calculator/docs/short_stay_schengen_calculator_user_manual_en.pdf)
contains section 6 examples on printed pages 5-7 using 2024 dates. Six published
arithmetic cases are encoded in `tests/fixtures/official_examples.json`: two
history snapshots and four fixed intervals derived from stated arrival dates and
durations. Five additional regression cases derive the next-day/first-violation
boundaries; those expectations are not represented as quoted official results.
The tests do not adjudicate the examples' visa circumstances. No live-calculator
comparison has been performed; broader reference coverage remains a release task.

Stage 3 additionally runs maximum-stay searches against the four published
duration cases in the same fixture. One earliest-entry regression is derived
from adjacent published cases and is labeled accordingly. These are offline
tests of the previously recorded source, not a new live-calculator comparison.
