"""Stage 2 history/itinerary behavior, including failures hidden by a final snapshot."""

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
    check_history,
    check_plan,
    usage_on,
)
from schengenstay.compliance import MAX_INSPECTED_DAYS
from schengenstay.dates import MIN_CHECK_DATE

D = date(2024, 1, 1)


def stay(start=0, end=0, identifier="a"):
    return ShortStay(identifier, D + timedelta(days=start), D + timedelta(days=end))


def test_empty_history_is_explicitly_complete_and_has_a_snapshot():
    result = check_history([], D)
    assert result.status is ResultStatus.WITHIN_RULE
    assert result.used_days == 0
    assert result.remaining_arithmetic_days == 90
    assert result.inspected_dates == 0
    assert result.first_violation_date is None
    assert result.snapshot == usage_on([], D)
    assert ReasonCode.NO_VIOLATION_FOUND in result.reason_codes
    assert "not permission" in " ".join(result.scope_notes)
    assert result.human_explanation_keys
    with pytest.raises(FrozenInstanceError):
        result.status = ResultStatus.VIOLATION


@pytest.mark.parametrize("length", [1, 89, 90, 91, 180, 500])
def test_first_violation_on_day_91(length):
    result = check_history([stay(0, length - 1)], D + timedelta(days=length - 1))
    assert result.inspected_dates == min(length, 91)
    if length <= 90:
        assert result.status is ResultStatus.WITHIN_RULE
        assert result.first_violation_date is None
    else:
        assert result.status is ResultStatus.VIOLATION
        assert result.first_violation_date == date(2024, 3, 31)
        assert result.violation_count == result.used_days == 91
        assert result.window_end == result.first_violation_date
        assert (result.window_end - result.window_start).days == 179
        assert result.inspected_through == result.first_violation_date


def test_old_violation_is_not_erased_by_empty_final_window():
    result = check_history([stay(0, 90)], date(2025, 1, 1))
    assert result.status is ResultStatus.VIOLATION
    assert result.first_violation_date == date(2024, 3, 31)
    assert result.used_days == 91
    assert result.snapshot.used_days == 0
    assert result.snapshot.remaining_arithmetic_days == 90


def test_multiple_trips_and_earliest_failure_with_unsorted_history():
    trips = [stay(60, 105, "b"), stay(0, 44)]
    result = check_history(trips, D + timedelta(days=105))
    assert result.status is ResultStatus.VIOLATION
    assert result.first_violation_date == D + timedelta(days=105)
    assert result.inspected_dates == 91
    assert check_history(list(reversed(trips)), result.check_date) == result


def test_window_boundary_exactly_180_days_and_gradual_expiry():
    trips = [stay(0, 89), stay(180, 269, "b")]
    assert check_history(trips, D + timedelta(days=269)).status is ResultStatus.WITHIN_RULE
    trips[1] = stay(179, 269, "b")
    result = check_history(trips, D + timedelta(days=269))
    assert result.first_violation_date == D + timedelta(days=179)
    assert result.violation_count == 91


@pytest.mark.parametrize(
    ("entry", "exit", "used"),
    [
        (date(2024, 2, 28), date(2024, 3, 1), 3),
        (date(2023, 2, 28), date(2023, 3, 1), 2),
        (date(2000, 2, 28), date(2000, 3, 1), 3),
        (date(1900, 2, 28), date(1900, 3, 1), 2),
        (date(2023, 12, 31), date(2024, 1, 1), 2),
        (date.max, date.max, 1),
        (MIN_CHECK_DATE, MIN_CHECK_DATE, 1),
    ],
)
def test_calendar_boundaries(entry, exit, used):
    result = check_history([ShortStay("a", entry, exit)], exit)
    assert result.status is ResultStatus.WITHIN_RULE
    assert result.used_days == result.inspected_dates == used


def test_future_records_are_clipped_and_reported_not_added_to_history_scan():
    result = check_history([stay(0, 90), stay(200, 300, "b")], D + timedelta(days=89))
    assert result.status is ResultStatus.WITHIN_RULE
    assert result.inspected_dates == 90
    assert ReasonCode.FUTURE_DATES_IGNORED in result.warnings
    assert result.snapshot.used_days == 90


def test_ongoing_stays_require_and_report_explicit_as_of():
    ongoing = OngoingStay("a", D)
    missing = check_history([ongoing])
    assert missing.status is ResultStatus.INSUFFICIENT_DATA
    assert ReasonCode.CHECK_DATE_REQUIRED in missing.reason_codes
    result = check_history([ongoing], date(2024, 3, 31))
    assert result.status is ResultStatus.VIOLATION
    assert result.snapshot.assumed_ongoing_ids == ("a",)
    assert ReasonCode.ONGOING_ASSUMED_THROUGH_CHECK_DATE in result.warnings
    assert not hasattr(ongoing, "exit")


@pytest.mark.parametrize(
    ("trips", "options", "status", "reason"),
    [
        (None, {}, ResultStatus.INSUFFICIENT_DATA, ReasonCode.HISTORY_REQUIRED),
        (
            [],
            {"history_complete": False},
            ResultStatus.INSUFFICIENT_DATA,
            ReasonCode.HISTORY_INCOMPLETE,
        ),
        (
            [],
            {"history_complete": None},
            ResultStatus.INSUFFICIENT_DATA,
            ReasonCode.HISTORY_INCOMPLETE,
        ),
        (
            [],
            {"scope": CalculationScope.UNKNOWN},
            ResultStatus.INSUFFICIENT_DATA,
            ReasonCode.COUNTABILITY_UNKNOWN,
        ),
        ([], {"scope": None}, ResultStatus.INSUFFICIENT_DATA, ReasonCode.COUNTABILITY_UNKNOWN),
        (
            [],
            {"scope": CalculationScope.SPECIAL_LEGAL_CONTEXT},
            ResultStatus.OUT_OF_SCOPE,
            ReasonCode.UNSUPPORTED_SCOPE,
        ),
        (
            [],
            {"scope": CalculationScope.VISA_VALIDITY},
            ResultStatus.OUT_OF_SCOPE,
            ReasonCode.UNSUPPORTED_SCOPE,
        ),
        (
            [],
            {"scope": CalculationScope.HISTORICAL_GEOGRAPHY},
            ResultStatus.OUT_OF_SCOPE,
            ReasonCode.UNSUPPORTED_SCOPE,
        ),
        (
            [ShortStay("a", date.min, date.min)],
            {},
            ResultStatus.OUT_OF_SCOPE,
            ReasonCode.HISTORY_DATE_RANGE_UNSUPPORTED,
        ),
        ([], {"scope": "visa D"}, ResultStatus.INVALID_INPUT, ReasonCode.INVALID_REQUEST),
        ([], {"history_complete": "yes"}, ResultStatus.INVALID_INPUT, ReasonCode.INVALID_REQUEST),
        ([stay(2, 1)], {}, ResultStatus.INVALID_INPUT, ReasonCode.INVALID_HISTORY),
        (
            [stay(), stay(identifier="b")],
            {},
            ResultStatus.INVALID_INPUT,
            ReasonCode.INVALID_HISTORY,
        ),
        ([stay(), stay(5, 5)], {}, ResultStatus.INVALID_INPUT, ReasonCode.INVALID_HISTORY),
        ([PlannedStay(D, D)], {}, ResultStatus.INVALID_INPUT, ReasonCode.INVALID_HISTORY),
        ({}, {}, ResultStatus.INVALID_INPUT, ReasonCode.INVALID_HISTORY),
    ],
)
def test_non_arithmetic_statuses_do_not_return_an_affirmative_result(
    trips, options, status, reason
):
    result = check_history(trips, D, **options)
    assert result.status is status
    assert reason in result.reason_codes
    assert result.snapshot is None
    assert result.used_days is None
    assert result.window_start is None
    assert result.first_violation_date is None


@pytest.mark.parametrize("day", ["2024-01-01", datetime(2024, 1, 1), date.min, 0])
def test_invalid_check_date_returns_structured_error(day):
    result = check_history([], day)
    assert result.status is ResultStatus.INVALID_INPUT
    assert result.issues and result.issues[0].field == "as_of"


@pytest.mark.parametrize("limit", [0, -1, True, None, 1.5, MAX_INSPECTED_DAYS + 1])
def test_invalid_inspection_budget(limit):
    result = check_history([], D, max_inspected_days=limit)
    assert result.status is ResultStatus.INVALID_INPUT


def test_status_precedence_blocks_partial_success():
    assert (
        check_history([stay(2, 1)], D, scope=CalculationScope.VISA_VALIDITY).status
        is ResultStatus.INVALID_INPUT
    )
    assert (
        check_history([], None, scope=CalculationScope.VISA_VALIDITY).status
        is ResultStatus.OUT_OF_SCOPE
    )
    assert (
        check_history([stay(0, 90)], D, history_complete=False).status
        is ResultStatus.INSUFFICIENT_DATA
    )


def test_inspection_budget_reports_partial_scan_and_never_within_rule():
    result = check_history([stay(0, 4)], D + timedelta(days=4), max_inspected_days=4)
    assert result.status is ResultStatus.HORIZON_LIMIT
    assert result.inspected_dates == 4
    assert result.inspected_through == D + timedelta(days=3)
    assert result.snapshot.used_days == 5
    assert ReasonCode.INSPECTION_LIMIT_REACHED in result.reason_codes
    assert (
        check_history([stay(0, 3)], D + timedelta(days=3), max_inspected_days=4).status
        is ResultStatus.WITHIN_RULE
    )


def test_failure_on_last_budgeted_day_takes_precedence_over_limit():
    result = check_history([stay(0, 100)], D + timedelta(days=100), max_inspected_days=91)
    assert result.status is ResultStatus.VIOLATION
    assert result.inspected_dates == 91


def test_very_long_stay_stops_at_first_failure_without_date_overflow():
    result = check_history([ShortStay("a", MIN_CHECK_DATE, date.max)], date.max)
    assert result.first_violation_date == MIN_CHECK_DATE + timedelta(days=90)
    assert result.inspected_dates == 91


def test_check_plan_keeps_history_separate_and_preserves_its_past_violation():
    trips = [stay(0, 90)]
    original = list(trips)
    plan = PlannedStay(date(2025, 1, 1), date(2025, 1, 2))
    result = check_plan(trips, plan, as_of=date(2024, 12, 31))
    assert result.status is ResultStatus.VIOLATION
    assert result.history_result.status is ResultStatus.VIOLATION
    assert result.itinerary_result.status is ResultStatus.WITHIN_RULE
    assert ReasonCode.HISTORICAL_VIOLATION in result.reason_codes
    assert trips == original
    assert check_history(trips, date(2024, 12, 31)) == result.history_result


def test_plan_reports_first_failing_interior_day_not_only_arrival_or_departure():
    trips = [stay(0, 88)]
    plan = PlannedStay(D + timedelta(days=100), D + timedelta(days=102))
    result = check_plan(trips, plan, as_of=D + timedelta(days=99))
    assert result.status is ResultStatus.VIOLATION
    assert result.itinerary_result.first_violation_date == plan.entry + timedelta(days=1)
    assert result.itinerary_result.snapshot.used_days == 92
    assert result.history_result.status is ResultStatus.WITHIN_RULE


@pytest.mark.parametrize(
    ("trips", "plan", "as_of", "status"),
    [
        ([], PlannedStay(D, D), None, ResultStatus.INSUFFICIENT_DATA),
        ([], None, D, ResultStatus.INSUFFICIENT_DATA),
        ([], stay(), D, ResultStatus.INVALID_INPUT),
        ([], PlannedStay("2024-02-01", "2024-02-02"), D, ResultStatus.INVALID_INPUT),
        ([], PlannedStay(date(2024, 2, 2), date(2024, 2, 1)), D, ResultStatus.INVALID_INPUT),
        ([], PlannedStay(D, D), D, ResultStatus.INVALID_INPUT),
        (
            [stay(0, 5)],
            PlannedStay(date(2024, 2, 1), date(2024, 2, 2)),
            D,
            ResultStatus.INVALID_INPUT,
        ),
        (
            [OngoingStay("a", D)],
            PlannedStay(date(2024, 2, 1), date(2024, 2, 2)),
            D,
            ResultStatus.INSUFFICIENT_DATA,
        ),
    ],
)
def test_plan_inputs_require_actual_history_and_distinct_future_dates(trips, plan, as_of, status):
    result = check_plan(trips, plan, as_of=as_of)
    assert result.status is status
    assert result.itinerary_result is None


def test_plan_context_and_inspection_limit():
    plan = PlannedStay(date(2024, 2, 1), date(2024, 2, 5))
    assert (
        check_plan([], plan, as_of=D, scope=CalculationScope.UNKNOWN).status
        is ResultStatus.INSUFFICIENT_DATA
    )
    assert (
        check_plan([], plan, as_of=D, scope=CalculationScope.VISA_VALIDITY).status
        is ResultStatus.OUT_OF_SCOPE
    )
    assert check_plan([], plan, as_of=D, max_inspected_days=4).status is ResultStatus.HORIZON_LIMIT
    assert check_plan([stay(0, 90)], plan, as_of=D).status is ResultStatus.INVALID_INPUT


def test_plan_max_date_and_leap_day():
    result = check_plan([], PlannedStay(date.max, date.max), as_of=date.max - timedelta(days=1))
    assert result.status is ResultStatus.WITHIN_RULE
    assert result.itinerary_result.used_days == 1
    result = check_plan([], PlannedStay(date(2024, 2, 28), date(2024, 3, 1)), as_of=D)
    assert result.itinerary_result.inspected_dates == 3


def test_history_limit_and_malformed_future_inputs_block_compliance():
    assert (
        check_history([stay(identifier=str(i)) for i in range(501)], D).status
        is ResultStatus.INVALID_INPUT
    )
    assert check_history([stay(300, 299)], D).status is ResultStatus.INVALID_INPUT
    assert (
        check_history([OngoingStay("a", D + timedelta(days=1))], D).status
        is ResultStatus.INVALID_INPUT
    )


def test_plan_history_budget_exhaustion_prevents_a_passing_itinerary():
    result = check_plan(
        [stay(0, 4)],
        PlannedStay(D + timedelta(days=6), D + timedelta(days=7)),
        as_of=D + timedelta(days=5),
        max_inspected_days=4,
    )
    assert result.status is ResultStatus.HORIZON_LIMIT
    assert result.history_result.inspected_dates == 4
    assert result.itinerary_result is None


def test_history_budget_does_not_guess_an_uninspected_failure():
    result = check_plan(
        [stay(0, 90)],
        PlannedStay(date(2025, 1, 1), date(2025, 4, 30)),
        as_of=date(2024, 12, 31),
        max_inspected_days=90,
    )
    # Budget stops history before it can prove the 91st-day violation.
    assert result.status is ResultStatus.HORIZON_LIMIT
    assert result.itinerary_result is None


def test_large_gaps_are_not_counted_as_inspected_days():
    result = check_history(
        [ShortStay("a", MIN_CHECK_DATE, MIN_CHECK_DATE), ShortStay("b", date.max, date.max)],
        date.max,
        max_inspected_days=2,
    )
    assert result.status is ResultStatus.WITHIN_RULE
    assert result.inspected_dates == 2


def test_plan_results_are_immutable_and_have_explanation_keys():
    result = check_plan([], PlannedStay(date(2024, 2, 1), date(2024, 2, 1)), as_of=D)
    assert result.human_explanation_keys == ("compliance.no_violation_found",)
    with pytest.raises(FrozenInstanceError):
        result.status = ResultStatus.VIOLATION
