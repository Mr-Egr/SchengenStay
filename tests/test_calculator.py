"""Hand-counted fixtures for Stage 1 snapshots, not official compliance fixtures."""

from dataclasses import FrozenInstanceError
from datetime import date, datetime, timedelta

import pytest

from schengenstay import OngoingStay, ShortStay, usage_on
from schengenstay.dates import MIN_CHECK_DATE
from schengenstay.validation import HistoryValidationError, IssueCode


def test_empty_history():
    result = usage_on([], date(2024, 6, 30))
    assert result.check_date == result.window_end == date(2024, 6, 30)
    assert result.window_start == date(2024, 1, 3)
    assert result.used_days == 0
    assert result.remaining_arithmetic_days == 90
    assert result.assumed_ongoing_ids == ()
    assert "not permission" in " ".join(result.scope_notes)
    assert not hasattr(result, "status")


@pytest.mark.parametrize(
    ("entry", "exit", "day", "expected"),
    [
        ("2024-02-29", "2024-02-29", "2024-02-29", 1),
        ("2024-02-28", "2024-03-01", "2024-03-01", 3),
        ("2023-02-28", "2023-03-01", "2023-03-01", 2),
        ("2023-12-31", "2024-01-01", "2024-01-01", 2),
        ("2024-01-01", "2024-01-31", "2024-01-15", 15),
        ("2024-02-01", "2024-02-10", "2024-01-31", 0),
        ("2024-01-01", "2024-01-31", "2024-12-31", 0),
    ],
)
def test_hand_counted_snapshots(entry, exit, day, expected):
    result = usage_on(
        [ShortStay("a", date.fromisoformat(entry), date.fromisoformat(exit))],
        date.fromisoformat(day),
    )
    assert result.used_days == expected
    assert result.remaining_arithmetic_days == 90 - expected


def test_rolling_window_includes_d_minus_179_excludes_d_minus_180_and_future():
    day = date(2024, 6, 30)
    stays = [
        ShortStay(str(offset), day + timedelta(days=offset), day + timedelta(days=offset))
        for offset in (-180, -179, 0, 1)
    ]
    assert usage_on(stays, day).used_days == 2


def test_90_and_91_days_are_counted_on_every_day_without_compliance_api():
    start = date(2024, 1, 1)
    stays = [ShortStay("a", start, date(2024, 3, 31))]
    counts = [usage_on(stays, start + timedelta(days=i)).used_days for i in range(91)]
    assert counts == list(range(1, 92))
    assert next(i + 1 for i, count in enumerate(counts) if count > 90) == 91
    assert usage_on(stays, date(2024, 3, 30)).remaining_arithmetic_days == 0
    assert usage_on(stays, date(2024, 3, 31)).remaining_arithmetic_days == 0


def test_two_separate_stays_total_90_then_91():
    stays = [
        ShortStay("a", date(2024, 1, 1), date(2024, 2, 14)),
        ShortStay("b", date(2024, 3, 1), date(2024, 4, 15)),
    ]
    assert usage_on(stays, date(2024, 4, 14)).used_days == 90
    assert usage_on(stays, date(2024, 4, 15)).used_days == 91


def test_old_coverage_expires_one_day_at_a_time_after_90_days_outside():
    start = date(2024, 1, 1)
    stays = [ShortStay("a", start, start + timedelta(days=89))]
    assert usage_on(stays, start + timedelta(days=179)).used_days == 90
    assert [usage_on(stays, start + timedelta(days=180 + i)).used_days for i in range(90)] == list(
        range(89, -1, -1)
    )


def test_ongoing_uses_explicit_check_date_and_reports_assumption():
    stay = OngoingStay("a", date(2024, 2, 28))
    result = usage_on([stay], date(2024, 3, 1))
    assert result.used_days == 3
    assert result.assumed_ongoing_ids == ("a",)
    assert result.check_date == date(2024, 3, 1)
    assert usage_on([stay], date(2024, 2, 28)).used_days == 1
    assert not hasattr(stay, "exit")
    with pytest.raises(TypeError):
        usage_on([stay])


def test_long_history_clips_without_enumerating_all_dates():
    stays = [ShortStay("a", date.min, date.max)]
    for day in (MIN_CHECK_DATE, date(2024, 1, 1), date.max):
        result = usage_on(stays, day)
        assert result.used_days == 180
        assert result.remaining_arithmetic_days == 0


@pytest.mark.parametrize("day", [None, "2024-01-01", datetime(2024, 1, 1)])
def test_invalid_check_date_rejected(day):
    with pytest.raises(TypeError):
        usage_on([], day)


def test_check_date_underflow_rejected():
    with pytest.raises(ValueError, match="180"):
        usage_on([], date.min)


def test_invalid_future_history_is_not_silently_ignored():
    with pytest.raises(HistoryValidationError) as error:
        usage_on([ShortStay("bad", date(2025, 2, 1), date(2025, 1, 1))], date(2024, 1, 1))
    assert error.value.issues[0].code is IssueCode.REVERSED_INTERVAL


def test_result_is_immutable():
    result = usage_on([], date(2024, 1, 1))
    with pytest.raises(FrozenInstanceError):
        result.used_days = 1
