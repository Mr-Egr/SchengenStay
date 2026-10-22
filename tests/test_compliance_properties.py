"""Stage 2 checks against a separate occupied-date-set oracle."""

from datetime import date, timedelta

from hypothesis import given, settings
from hypothesis import strategies as st

from schengenstay import PlannedStay, ResultStatus, ShortStay, check_history, check_plan

BASE = date(2020, 1, 1)


@st.composite
def histories(draw):
    # Generated disjoint intervals; no production normalizer builds the oracle input.
    pairs = draw(st.lists(st.tuples(st.integers(0, 100), st.integers(1, 100)), max_size=5))
    cursor = 0
    trips = []
    occupied = set()
    for i, (gap, length) in enumerate(pairs):
        cursor += gap
        trips.append(
            ShortStay(
                str(i), BASE + timedelta(days=cursor), BASE + timedelta(days=cursor + length - 1)
            )
        )
        occupied.update(cursor + n for n in range(length))
        cursor += length
    return trips, occupied, cursor


def first_failure(occupied, inspected):
    return next(
        (d for d in sorted(inspected) if sum(0 <= d - x < 180 for x in occupied) > 90), None
    )


@settings(max_examples=200, derandomize=True)
@given(histories(), st.integers(0, 1000), st.data())
def test_history_result_matches_daily_oracle_and_is_order_invariant(case, offset, data):
    trips, occupied, _ = case
    day = BASE + timedelta(days=offset)
    inspected = {d for d in occupied if d <= offset}
    fail = first_failure(occupied, inspected)
    result = check_history(trips, day)
    assert result.status is (ResultStatus.WITHIN_RULE if fail is None else ResultStatus.VIOLATION)
    assert result.first_violation_date == (None if fail is None else BASE + timedelta(days=fail))
    assert result.snapshot.used_days == sum(0 <= offset - x < 180 for x in occupied)
    assert result.inspected_dates == sum(fail is None or x <= fail for x in inspected)
    assert check_history(data.draw(st.permutations(trips)), day) == result
    if fail is not None:
        assert result.violation_count == 91


@settings(max_examples=200, derandomize=True)
@given(histories(), st.integers(1, 100))
def test_fixed_plan_matches_oracle_and_cannot_erase_history(case, length):
    trips, occupied, cursor = case
    start = cursor + 10
    plan_days = set(range(start, start + length))
    fail = first_failure(occupied | plan_days, plan_days)
    plan = PlannedStay(BASE + timedelta(days=start), BASE + timedelta(days=start + length - 1))
    result = check_plan(trips, plan, as_of=BASE + timedelta(days=cursor))
    assert result.itinerary_result.first_violation_date == (
        None if fail is None else BASE + timedelta(days=fail)
    )
    assert result.itinerary_result.status is (
        ResultStatus.WITHIN_RULE if fail is None else ResultStatus.VIOLATION
    )
    historical_failure = first_failure(occupied, occupied)
    assert result.status is (
        ResultStatus.VIOLATION
        if fail is not None or historical_failure is not None
        else ResultStatus.WITHIN_RULE
    )


@settings(max_examples=200, derandomize=True)
@given(histories())
def test_later_check_date_cannot_erase_earlier_historical_violation(case):
    trips, occupied, cursor = case
    early = check_history(trips, BASE + timedelta(days=cursor))
    late = check_history(trips, BASE + timedelta(days=cursor + 500))
    assert early.status is late.status
    assert early.first_violation_date == late.first_violation_date
    assert late.snapshot.used_days == 0


@settings(max_examples=200, derandomize=True)
@given(histories(), st.integers(1, 100))
def test_inspection_limit_never_claims_unchecked_days_pass(case, budget):
    trips, occupied, cursor = case
    fail = first_failure(occupied, occupied)
    checked = sorted(occupied)[:budget]
    result = check_history(trips, BASE + timedelta(days=cursor), max_inspected_days=budget)
    if fail is not None and fail in checked:
        assert result.status is ResultStatus.VIOLATION
    elif len(occupied) > budget:
        assert result.status is ResultStatus.HORIZON_LIMIT
    else:
        assert result.status is ResultStatus.WITHIN_RULE
    assert result.inspected_dates <= budget
