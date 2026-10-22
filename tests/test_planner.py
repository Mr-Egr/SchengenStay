"""Bounded planning, result interpretation, and immutable scenario inputs."""

from dataclasses import FrozenInstanceError
from datetime import date, datetime, timedelta

import pytest

from schengenstay import (
    CalculationScope,
    OngoingStay,
    PlannedStay,
    ReasonCode,
    ResultStatus,
    ShortStay,
    check_plan,
    compare_scenarios,
    find_earliest_entry,
    max_continuous_stay,
)
from schengenstay.dates import MIN_CHECK_DATE

D = date(2024, 1, 1)
AS_OF = date(2023, 12, 31)


def day(offset):
    return D + timedelta(days=offset)


def test_maximum_empty_history_checks_the_91st_day():
    result = max_continuous_stay([], D, 365, as_of=AS_OF)
    assert result.status is result.planning_status is ResultStatus.WITHIN_RULE
    assert result.consecutive_days == 90
    assert result.latest_compliant_exit == date(2024, 3, 30)
    assert result.first_violation_date == date(2024, 3, 31)
    assert result.maximum_proven
    assert result.evaluation.itinerary_result.used_days == 91
    assert result.evaluation.itinerary_result.inspected_dates == 91


@pytest.mark.parametrize("horizon", [1, 89, 90])
def test_passing_prefix_is_not_a_proven_maximum(horizon):
    result = max_continuous_stay([], D, horizon, as_of=AS_OF)
    assert result.status is ResultStatus.HORIZON_LIMIT
    assert result.consecutive_days == horizon
    assert result.latest_compliant_exit == day(horizon - 1)
    assert not result.maximum_proven
    assert result.first_violation_date is None


def test_expiring_history_allows_more_than_the_arrival_snapshot_remainder():
    history = [ShortStay("old", D, day(89))]
    result = max_continuous_stay(history, day(180), 91, as_of=day(179))
    assert result.consecutive_days == 90
    assert result.latest_compliant_exit == day(269)
    assert result.first_violation_date == day(270)
    assert result.status is ResultStatus.WITHIN_RULE
    # One day earlier, the arrival itself fails; do not skip it to find a later prefix.
    blocked = max_continuous_stay(history, day(179), 91, as_of=day(178))
    assert blocked.status is ResultStatus.VIOLATION
    assert blocked.consecutive_days == 0
    assert blocked.latest_compliant_exit is None
    assert blocked.first_violation_date == day(179)
    assert blocked.maximum_proven


@pytest.mark.parametrize("arrival", [date(2023, 12, 31), date(2024, 2, 28), date(1900, 2, 28)])
def test_maximum_crosses_calendar_boundaries(arrival):
    result = max_continuous_stay([], arrival, 91, as_of=arrival - timedelta(days=1))
    assert result.consecutive_days == 90
    assert result.latest_compliant_exit == arrival + timedelta(days=89)
    assert result.first_violation_date == arrival + timedelta(days=90)


def test_search_checks_whole_trip_and_returns_first_candidate():
    history = [ShortStay("a", D, day(79))]
    result = find_earliest_entry(history, 20, day(100), 100, as_of=day(99))
    assert result.status is ResultStatus.WITHIN_RULE
    assert result.entry == day(170)
    assert result.exit == day(189)
    assert result.candidates_checked == 71
    assert result.evaluation.itinerary_result.inspected_dates == 20
    assert result.evaluation.itinerary_result.used_days == 90
    assert (
        check_plan(history, PlannedStay(day(169), day(188)), as_of=day(99)).status
        is ResultStatus.VIOLATION
    )


def test_no_result_is_horizon_limited_and_last_candidate_is_included():
    history = [ShortStay("a", D, day(89))]
    absent = find_earliest_entry(history, 90, day(179), 1, as_of=day(178))
    assert absent.status is ResultStatus.HORIZON_LIMIT
    assert ReasonCode.NOT_FOUND_WITHIN_HORIZON in absent.reason_codes
    assert absent.entry is absent.exit is None
    assert not absent.arithmetic_impossible
    found = find_earliest_entry(history, 90, day(179), 2, as_of=day(178))
    assert found.entry == day(180)
    assert found.exit == day(269)  # Horizon bounds entries, not departures.
    assert found.search_horizon_end == day(180)


@pytest.mark.parametrize("length", [91, 180, 10000])
def test_longer_than_90_is_proven_arithmetically_impossible(length):
    result = find_earliest_entry([], length, D, 10, as_of=AS_OF)
    assert result.status is result.planning_status is ResultStatus.VIOLATION
    assert result.arithmetic_impossible
    assert ReasonCode.TRIP_LENGTH_EXCEEDS_LIMIT in result.reason_codes
    assert result.entry is None


def test_history_failure_is_preserved_without_blocking_future_arithmetic():
    history = [ShortStay("old", D, day(90))]
    cutoff = day(365)
    maximum = max_continuous_stay(history, day(366), 91, as_of=cutoff)
    earliest = find_earliest_entry(history, 10, day(366), 30, as_of=cutoff)
    for result in (maximum, earliest):
        assert result.status is ResultStatus.VIOLATION
        assert result.planning_status is ResultStatus.WITHIN_RULE
        assert result.history_result.first_violation_date == day(90)
        assert ReasonCode.HISTORICAL_VIOLATION in result.reason_codes
    assert maximum.consecutive_days == 90
    assert earliest.entry == day(366)


@pytest.mark.parametrize(
    ("history", "options", "status"),
    [
        (None, {}, ResultStatus.INSUFFICIENT_DATA),
        ([], {"as_of": None}, ResultStatus.INSUFFICIENT_DATA),
        ([], {"history_complete": False}, ResultStatus.INSUFFICIENT_DATA),
        ([], {"scope": CalculationScope.UNKNOWN}, ResultStatus.INSUFFICIENT_DATA),
        ([], {"scope": CalculationScope.VISA_VALIDITY}, ResultStatus.OUT_OF_SCOPE),
        ([OngoingStay("a", AS_OF)], {}, ResultStatus.INSUFFICIENT_DATA),
        ([ShortStay("a", date.min, date.min)], {}, ResultStatus.OUT_OF_SCOPE),
        ([ShortStay("a", D, D)], {}, ResultStatus.INVALID_INPUT),
        ([PlannedStay(AS_OF, AS_OF)], {}, ResultStatus.INVALID_INPUT),
        ({}, {}, ResultStatus.INVALID_INPUT),
        ([], {"max_inspected_days": True}, ResultStatus.INVALID_INPUT),
    ],
)
def test_context_outcomes_propagate_through_both_searches(history, options, status):
    kwargs = {"as_of": AS_OF} | options
    results = [
        max_continuous_stay(history, D, 91, **kwargs),
        find_earliest_entry(history, 1, D, 91, **kwargs),
        find_earliest_entry(history, 91, D, 91, **kwargs),
    ]
    for result in results:
        assert result.status is status
        assert result.planning_status is status
    assert results[0].consecutive_days is None
    assert all(result.entry is None for result in results[1:])


@pytest.mark.parametrize("value", [0, -1, True, None, "10", 1.5, 10001])
def test_positive_integer_bounds_are_strict(value):
    assert max_continuous_stay([], D, value, as_of=AS_OF).status is ResultStatus.INVALID_INPUT
    assert find_earliest_entry([], 1, D, value, as_of=AS_OF).status is ResultStatus.INVALID_INPUT
    result = find_earliest_entry([], value, D, 1, as_of=AS_OF)
    assert result.status is ResultStatus.INVALID_INPUT
    assert result.issues[0].field == "length_days"


@pytest.mark.parametrize("value", [None, "2024-01-01", datetime(2024, 1, 1), date.min, AS_OF])
def test_invalid_start_dates_are_structured(value):
    assert max_continuous_stay([], value, 91, as_of=AS_OF).status is ResultStatus.INVALID_INPUT
    assert find_earliest_entry([], 1, value, 91, as_of=AS_OF).status is ResultStatus.INVALID_INPUT


def test_occupied_date_is_rejected_even_when_cutoff_is_before_it():
    history = [ShortStay("actual", D, day(5))]
    for cutoff in (AS_OF, day(5)):
        assert (
            max_continuous_stay(history, D, 91, as_of=cutoff).status is ResultStatus.INVALID_INPUT
        )
        assert (
            find_earliest_entry(history, 1, D, 91, as_of=cutoff).status
            is ResultStatus.INVALID_INPUT
        )


def test_calendar_bounds_are_validated_without_overflow_or_silent_clamping():
    assert (
        max_continuous_stay([], date.max, 1, as_of=date.max - timedelta(days=1)).consecutive_days
        == 1
    )
    assert (
        max_continuous_stay([], date.max, 2, as_of=date.max - timedelta(days=1)).status
        is ResultStatus.INVALID_INPUT
    )
    assert find_earliest_entry([], 2, date.max, 1, as_of=AS_OF).status is ResultStatus.INVALID_INPUT
    assert find_earliest_entry([], 1, date.max, 2, as_of=AS_OF).status is ResultStatus.INVALID_INPUT
    result = find_earliest_entry([], 1, date.max, 1, as_of=AS_OF)
    assert result.entry == result.exit == date.max
    assert (
        max_continuous_stay([], MIN_CHECK_DATE, 1, as_of=MIN_CHECK_DATE).status
        is ResultStatus.INVALID_INPUT
    )


def test_inspection_budgets_never_claim_a_maximum_or_skip_an_unknown_candidate():
    limited = max_continuous_stay([], D, 91, as_of=AS_OF, max_inspected_days=90)
    assert limited.status is ResultStatus.HORIZON_LIMIT
    assert limited.consecutive_days == 90
    assert not limited.maximum_proven
    unknown = find_earliest_entry([], 3, D, 10, as_of=AS_OF, max_inspected_days=2)
    assert unknown.status is ResultStatus.HORIZON_LIMIT
    assert unknown.candidates_checked == 1
    assert unknown.inspected_plan_days == 2
    assert unknown.entry is None
    assert ReasonCode.INSPECTION_LIMIT_REACHED in unknown.reason_codes
    history = [ShortStay("a", D, day(89))]
    # Every rejected entry uses one day; plan budget is shared across candidates.
    result = find_earliest_entry(history, 1, day(90), 100, as_of=day(89), max_inspected_days=90)
    assert result.status is ResultStatus.HORIZON_LIMIT
    assert result.candidates_checked == result.inspected_plan_days == 90
    assert result.entry is None


def test_history_budget_blocks_planning_and_propagates_evidence():
    history = [ShortStay("a", D, day(9))]
    for result in (
        max_continuous_stay(history, day(20), 91, as_of=day(19), max_inspected_days=5),
        find_earliest_entry(history, 1, day(20), 91, as_of=day(19), max_inspected_days=5),
    ):
        assert result.status is ResultStatus.HORIZON_LIMIT
        assert result.history_result.inspected_dates == 5
        assert result.evaluation.itinerary_result is None


def test_scenarios_are_independent_ordered_and_do_not_mutate_inputs():
    history = [ShortStay("a", D, day(89))]
    plans = [PlannedStay(day(179), day(179)), PlannedStay(day(180), day(269))]
    original_history, original_plans = history.copy(), plans.copy()
    comparison = compare_scenarios(history, plans, as_of=day(178))
    assert comparison.status is ResultStatus.VIOLATION
    assert tuple(item.index for item in comparison.scenarios) == (0, 1)
    for item, plan in zip(comparison.scenarios, plans, strict=True):
        assert item.plan == plan
        assert item.result == check_plan(history, plan, as_of=day(178))
    assert comparison.scenarios[1].result.status is ResultStatus.WITHIN_RULE
    assert history == original_history and plans == original_plans
    with pytest.raises(FrozenInstanceError):
        comparison.status = ResultStatus.WITHIN_RULE


@pytest.mark.parametrize("plans", [None, "bad", {}, iter(()), [], [PlannedStay(D, D)] * 101])
def test_invalid_scenario_container(plans):
    result = compare_scenarios([], plans, as_of=AS_OF)
    assert result.status is ResultStatus.INVALID_INPUT
    assert result.issues[0].field == "scenarios"


def test_invalid_scenario_does_not_hide_other_results_or_unknown_context():
    result = compare_scenarios([], [None, PlannedStay(D, D)], as_of=AS_OF)
    assert result.status is ResultStatus.INSUFFICIENT_DATA
    assert result.scenarios[0].result.status is ResultStatus.INSUFFICIENT_DATA
    assert result.scenarios[1].result.status is ResultStatus.WITHIN_RULE
    unknown = compare_scenarios([], [PlannedStay(D, D)], as_of=AS_OF, history_complete=False)
    assert unknown.status is ResultStatus.INSUFFICIENT_DATA


def test_search_results_are_immutable_and_disclaim_legal_authorization():
    for result in (
        max_continuous_stay([], D, 91, as_of=AS_OF),
        find_earliest_entry([], 1, D, 1, as_of=AS_OF),
    ):
        assert result.human_explanation_keys
        assert "not permission" in " ".join(result.scope_notes)
        with pytest.raises(FrozenInstanceError):
            result.status = ResultStatus.VIOLATION


def test_historical_failure_and_incomplete_search_are_both_visible():
    history = [ShortStay("a", D, day(90))]
    maximum = max_continuous_stay(history, day(365), 10, as_of=day(364))
    earliest = find_earliest_entry(history, 1, day(91), 1, as_of=day(90))
    for result in (maximum, earliest):
        assert result.status is ResultStatus.VIOLATION
        assert result.planning_status is ResultStatus.HORIZON_LIMIT
        assert ReasonCode.HISTORICAL_VIOLATION in result.reason_codes
    assert ReasonCode.NOT_FOUND_WITHIN_HORIZON in earliest.reason_codes
    assert not earliest.arithmetic_impossible


def test_success_and_proven_failure_on_last_inspection_take_precedence():
    maximum = max_continuous_stay([], D, 10000, as_of=AS_OF, max_inspected_days=91)
    assert maximum.maximum_proven
    assert maximum.consecutive_days == 90
    assert maximum.evaluation.itinerary_result.window_start == day(90 - 179)
    found = find_earliest_entry([], 90, D, 10, as_of=AS_OF, max_inspected_days=90)
    assert found.status is ResultStatus.WITHIN_RULE
    assert found.inspected_plan_days == 90
    uncertain = find_earliest_entry([], 91, D, 10, as_of=AS_OF, max_inspected_days=90)
    assert uncertain.status is ResultStatus.HORIZON_LIMIT
    assert not uncertain.arithmetic_impossible


@pytest.mark.parametrize(
    ("entry", "length", "exit"),
    [
        (date(2024, 2, 28), 3, date(2024, 3, 1)),
        (date(2023, 12, 31), 2, date(2024, 1, 1)),
        (date(1900, 2, 28), 2, date(1900, 3, 1)),
    ],
)
def test_earliest_entry_uses_inclusive_calendar_days(entry, length, exit):
    result = find_earliest_entry([], length, entry, 1, as_of=entry - timedelta(days=1))
    assert result.entry == entry and result.exit == exit
    assert result.inspected_plan_days == length


@pytest.mark.parametrize(
    "history",
    [
        [ShortStay("a", AS_OF, AS_OF)] * 2,
        [ShortStay("a", AS_OF, AS_OF), ShortStay("b", AS_OF, AS_OF)],
        [ShortStay("a", D, AS_OF)],
        [ShortStay(str(i), AS_OF, AS_OF) for i in range(501)],
    ],
)
def test_invalid_history_cannot_produce_a_search_result(history):
    assert max_continuous_stay(history, D, 91, as_of=AS_OF).status is ResultStatus.INVALID_INPUT
    assert find_earliest_entry(history, 1, D, 91, as_of=AS_OF).status is ResultStatus.INVALID_INPUT


def test_scenario_limit_and_mixed_invalid_results():
    result = compare_scenarios([], [PlannedStay(D, D)] * 100, as_of=AS_OF)
    assert result.status is ResultStatus.WITHIN_RULE
    assert len(result.scenarios) == 100
    mixed = compare_scenarios([], [{}, PlannedStay(D, D)], as_of=AS_OF)
    assert mixed.status is ResultStatus.INVALID_INPUT
    assert mixed.scenarios[0].result.issues
    assert mixed.scenarios[1].result.status is ResultStatus.WITHIN_RULE


def test_no_match_at_exact_candidate_budget_reports_horizon_exhaustion():
    history = [ShortStay("a", D, day(89))]
    result = find_earliest_entry(history, 1, day(90), 90, as_of=day(89), max_inspected_days=90)
    assert result.reason_codes == (ReasonCode.NOT_FOUND_WITHIN_HORIZON,)
    assert result.candidates_checked == 90
