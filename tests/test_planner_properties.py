"""Searches compared with an independent, enumerating occupied-date oracle."""

from datetime import date, timedelta

from hypothesis import given, settings
from hypothesis import strategies as st

from schengenstay import (
    PlannedStay,
    ResultStatus,
    ShortStay,
    compare_scenarios,
    find_earliest_entry,
    max_continuous_stay,
)


@st.composite
def histories(draw):
    base = draw(st.dates(min_value=date(2, 1, 1), max_value=date(9990, 1, 1)))
    pairs = draw(st.lists(st.tuples(st.integers(0, 100), st.integers(1, 95)), max_size=4))
    cursor, occupied, trips = 0, set(), []
    for i, (gap, length) in enumerate(pairs):
        cursor += gap
        trips.append(
            ShortStay(
                str(i), base + timedelta(days=cursor), base + timedelta(days=cursor + length - 1)
            )
        )
        occupied.update(range(cursor, cursor + length))
        cursor += length
    return base, trips, occupied, cursor


def failure(occupied, proposed):
    combined = occupied | set(proposed)
    return next((d for d in proposed if sum(0 <= d - x < 180 for x in combined) > 90), None)


@settings(max_examples=200, derandomize=True)
@given(histories(), st.integers(1, 200), st.integers(1, 120))
def test_maximum_matches_date_set_oracle_and_history_order(case, gap, horizon):
    base, history, occupied, cursor = case
    start = cursor + gap
    first = failure(occupied, range(start, start + horizon))
    expected_length = first - start if first is not None else horizon
    before = history.copy()
    kwargs = dict(as_of=base + timedelta(days=cursor))
    result = max_continuous_stay(history, base + timedelta(days=start), horizon, **kwargs)
    assert result.consecutive_days == expected_length
    assert result.maximum_proven == (first is not None)
    assert result.first_violation_date == (
        base + timedelta(days=first) if first is not None else None
    )
    assert result.latest_compliant_exit == (
        base + timedelta(days=start + expected_length - 1) if expected_length else None
    )
    expected = (
        ResultStatus.HORIZON_LIMIT
        if first is None
        else (ResultStatus.WITHIN_RULE if expected_length else ResultStatus.VIOLATION)
    )
    assert result.planning_status is expected
    past_failure = failure(occupied, sorted(occupied))
    assert result.status is (ResultStatus.VIOLATION if past_failure is not None else expected)
    assert result == max_continuous_stay(
        tuple(reversed(history)), base + timedelta(days=start), horizon, **kwargs
    )
    assert history == before


@settings(max_examples=200, derandomize=True)
@given(histories(), st.integers(1, 200), st.integers(1, 90), st.integers(1, 25))
def test_earliest_matches_exhaustive_oracle_and_is_minimal(case, gap, length, horizon):
    base, history, occupied, cursor = case
    start = cursor + gap
    expected = next(
        (
            d
            for d in range(start, start + horizon)
            if failure(occupied, range(d, d + length)) is None
        ),
        None,
    )
    before = history.copy()
    result = find_earliest_entry(
        history, length, base + timedelta(days=start), horizon, as_of=base + timedelta(days=cursor)
    )
    assert result.entry == (base + timedelta(days=expected) if expected is not None else None)
    assert result.exit == (
        base + timedelta(days=expected + length - 1) if expected is not None else None
    )
    assert result.candidates_checked == (expected - start + 1 if expected is not None else horizon)
    assert result.planning_status is (
        ResultStatus.WITHIN_RULE if expected is not None else ResultStatus.HORIZON_LIMIT
    )
    assert not result.arithmetic_impossible
    assert history == before


@settings(max_examples=200, derandomize=True)
@given(histories(), st.integers(1, 100), st.integers(1, 100))
def test_search_budget_is_global_and_never_labels_an_uncertain_candidate_earliest(
    case, length, budget
):
    base, history, occupied, cursor = case
    start = cursor + 1
    result = find_earliest_entry(
        history,
        length,
        base + timedelta(days=start),
        100,
        as_of=base + timedelta(days=cursor),
        max_inspected_days=budget,
    )
    assert result.inspected_plan_days <= budget
    assert result.candidates_checked <= budget
    if result.entry is not None:
        offset = (result.entry - base).days
        assert failure(occupied, range(offset, offset + length)) is None
        assert all(
            failure(occupied, range(d, d + length)) is not None for d in range(start, offset)
        )
    if result.arithmetic_impossible:
        assert length > 90


@settings(max_examples=200, derandomize=True)
@given(
    histories(),
    st.lists(st.tuples(st.integers(1, 200), st.integers(1, 100)), min_size=1, max_size=4),
)
def test_scenarios_match_independent_oracle_without_accumulating_plans(case, choices):
    base, history, occupied, cursor = case
    plans = [
        PlannedStay(
            base + timedelta(days=cursor + gap), base + timedelta(days=cursor + gap + length - 1)
        )
        for gap, length in choices
    ]
    before = history.copy(), plans.copy()
    result = compare_scenarios(history, plans, as_of=base + timedelta(days=cursor))
    for scenario, (gap, length) in zip(result.scenarios, choices, strict=True):
        first = failure(occupied, range(cursor + gap, cursor + gap + length))
        itinerary = scenario.result.itinerary_result
        assert itinerary.first_violation_date == (
            base + timedelta(days=first) if first is not None else None
        )
        assert itinerary.status is (
            ResultStatus.VIOLATION if first is not None else ResultStatus.WITHIN_RULE
        )
    assert (history, plans) == before
    reversed_result = compare_scenarios(
        history, list(reversed(plans)), as_of=base + timedelta(days=cursor)
    )
    assert tuple(item.result for item in result.scenarios) == tuple(
        item.result for item in reversed(reversed_result.scenarios)
    )
