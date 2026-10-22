"""Calendar and closed-interval boundaries, independent of travel status."""

from dataclasses import FrozenInstanceError
from datetime import date, datetime, timedelta

import pytest

from schengenstay.dates import (
    MIN_CHECK_DATE,
    DateInterval,
    count_occupied_days,
    inclusive_length,
    normalize_intervals,
    parse_iso_date,
    rolling_window,
)


@pytest.mark.parametrize("value", ["0001-01-01", "2024-02-29", "9999-12-31"])
def test_parse_canonical_iso_date(value):
    assert parse_iso_date(value).isoformat() == value


@pytest.mark.parametrize(
    "value",
    [
        "2023-02-29",
        "1900-02-29",
        "2024-04-31",
        "0000-01-01",
        "10000-01-01",
        "2024-00-01",
        "2024-13-01",
        "2024-01-00",
        "2024-01-32",
        "",
        "20240101",
        "2024-W01-1",
        "2024-1-01",
        "01/01/2024",
        "2024-01-01T00:00:00",
        " 2024-01-01",
        "2024-01-01\n",
        "２０２４-０１-０１",
    ],
)
def test_parse_rejects_invalid_or_noncanonical_dates(value):
    with pytest.raises(ValueError):
        parse_iso_date(value)


@pytest.mark.parametrize("value", [None, 20240101, date(2024, 1, 1), b"2024-01-01"])
def test_parser_requires_text(value):
    with pytest.raises(TypeError):
        parse_iso_date(value)


@pytest.mark.parametrize(
    ("start", "end", "expected"),
    [
        (date(2024, 1, 1), date(2024, 1, 1), 1),
        (date(2024, 2, 28), date(2024, 3, 1), 3),
        (date(2023, 2, 28), date(2023, 3, 1), 2),
        (date(2000, 2, 28), date(2000, 3, 1), 3),
        (date(1900, 2, 28), date(1900, 3, 1), 2),
        (date(2023, 12, 31), date(2024, 1, 1), 2),
        (date(2024, 4, 30), date(2024, 5, 1), 2),
        (date.min, date.max, 3652059),
    ],
)
def test_inclusive_length(start, end, expected):
    assert inclusive_length(start, end) == expected
    assert DateInterval(start, end).days == expected


def test_reversed_interval_is_rejected():
    with pytest.raises(ValueError, match="end"):
        DateInterval(date(2024, 2, 1), date(2024, 1, 1))


@pytest.mark.parametrize("value", [None, "2024-01-01", datetime(2024, 1, 1), 1])
def test_date_helpers_reject_timestamps_and_non_dates(value):
    with pytest.raises(TypeError):
        DateInterval(value, date(2024, 1, 1))
    with pytest.raises(TypeError):
        DateInterval(date(2024, 1, 1), value)
    with pytest.raises(TypeError):
        rolling_window(value)


def test_interval_is_immutable():
    interval = DateInterval(date.min, date.max)
    with pytest.raises(FrozenInstanceError):
        interval.start = date.max


@pytest.mark.parametrize("day", [MIN_CHECK_DATE, date(2024, 2, 29), date.max])
def test_window_is_exactly_180_inclusive_days(day):
    window = rolling_window(day)
    assert window == DateInterval(day - timedelta(days=179), day)
    assert window.days == 180


def test_minimum_check_date_keeps_full_window():
    assert MIN_CHECK_DATE == date(1, 6, 29)
    assert rolling_window(MIN_CHECK_DATE).start == date.min
    with pytest.raises(ValueError, match="180"):
        rolling_window(MIN_CHECK_DATE - timedelta(days=1))


def test_normalization_merges_overlap_duplicates_and_adjacency_without_mutating_input():
    a = DateInterval(date(2024, 1, 1), date(2024, 1, 10))
    b = DateInterval(date(2024, 1, 4), date(2024, 1, 5))
    c = DateInterval(date(2024, 1, 11), date(2024, 1, 12))
    d = DateInterval(date(2024, 1, 14), date(2024, 1, 14))
    source = [d, c, b, a, a]
    original = list(source)
    assert normalize_intervals(source) == (
        DateInterval(date(2024, 1, 1), date(2024, 1, 12)),
        d,
    )
    assert source == original
    assert normalize_intervals([]) == ()


def test_normalization_and_counting_do_not_overflow_at_date_max():
    interval = DateInterval(date.min, date.max)
    assert normalize_intervals([interval, DateInterval(date.max, date.max)]) == (interval,)
    assert count_occupied_days([interval, interval], rolling_window(date.max)) == 180
    assert count_occupied_days([interval], DateInterval(date.max, date.max)) == 1


def test_count_intersections_is_unique_and_window_bounded():
    window = DateInterval(date(2024, 1, 3), date(2024, 1, 6))
    intervals = [
        DateInterval(date(2023, 1, 1), date(2024, 1, 4)),
        DateInterval(date(2024, 1, 4), date(2024, 1, 7)),
        DateInterval(date(2024, 2, 1), date(2024, 2, 2)),
    ]
    assert count_occupied_days(intervals, window) == 4
    assert count_occupied_days([], window) == 0
