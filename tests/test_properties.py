"""Independent date-set oracle and invariants for interval-based arithmetic."""

from datetime import date, timedelta

from hypothesis import given, settings
from hypothesis import strategies as st

from schengenstay import ShortStay, usage_on, validate_history
from schengenstay.dates import (
    MIN_CHECK_DATE,
    DateInterval,
    count_occupied_days,
    inclusive_length,
    normalize_intervals,
    parse_iso_date,
    rolling_window,
)
from schengenstay.validation import IssueCode

CHECK_DATES = st.dates(min_value=MIN_CHECK_DATE)


@st.composite
def interval_cases(draw):
    day = draw(CHECK_DATES)
    # Keep generated intervals short enough for an independent enumerating oracle,
    # while sampling the full supported calendar and dates on either side of D.
    raw = draw(st.lists(st.tuples(st.integers(-250, 20), st.integers(0, 60)), max_size=20))
    intervals = []
    for offset, length in raw:
        start = min(date.max.toordinal(), max(1, day.toordinal() + offset))
        end = min(date.max.toordinal(), start + length)
        intervals.append(DateInterval(date.fromordinal(start), date.fromordinal(end)))
    return day, intervals


def occupied_set(intervals):
    # Deliberately does not use production normalization/intersection helpers.
    return {
        date.fromordinal(ordinal)
        for interval in intervals
        for ordinal in range(interval.start.toordinal(), interval.end.toordinal() + 1)
    }


@settings(max_examples=200, derandomize=True)
@given(interval_cases())
def test_interval_count_matches_independent_unique_date_oracle(case):
    day, intervals = case
    window = rolling_window(day)
    expected = {d for d in occupied_set(intervals) if 0 <= (day - d).days < 180}
    actual = count_occupied_days(intervals, window)
    assert actual == len(expected)
    assert 0 <= actual <= 180
    assert count_occupied_days(intervals + intervals, window) == actual


@settings(max_examples=200, derandomize=True)
@given(interval_cases())
def test_normalization_preserves_coverage_and_is_idempotent(case):
    _, intervals = case
    normalized = normalize_intervals(intervals)
    assert occupied_set(normalized) == occupied_set(intervals)
    assert normalize_intervals(normalized) == normalized
    assert all((b.start - a.end).days > 1 for a, b in zip(normalized, normalized[1:], strict=False))


@settings(max_examples=200, derandomize=True)
@given(interval_cases(), st.data())
def test_public_usage_is_order_invariant_and_matches_oracle(case, data):
    day, intervals = case
    normalized = normalize_intervals(intervals)
    stays = [ShortStay(str(i), value.start, value.end) for i, value in enumerate(normalized)]
    shuffled = data.draw(st.permutations(stays))
    assert validate_history(stays) == []
    assert usage_on(stays, day) == usage_on(shuffled, day)
    expected = sum(0 <= (day - d).days < 180 for d in occupied_set(intervals))
    assert usage_on(stays, day).used_days == expected
    assert usage_on(stays, day).remaining_arithmetic_days == max(0, 90 - expected)


@settings(max_examples=200, derandomize=True)
@given(CHECK_DATES, st.sets(st.integers(0, 179), max_size=179))
def test_adding_one_unoccupied_day_in_window_increases_usage_by_one(day, offsets):
    missing = next(i for i in range(180) if i not in offsets)
    stays = [
        ShortStay(str(i), day - timedelta(days=i), day - timedelta(days=i)) for i in sorted(offsets)
    ]
    added = day - timedelta(days=missing)
    assert usage_on([*stays, ShortStay("new", added, added)], day).used_days == (
        usage_on(stays, day).used_days + 1
    )


@settings(max_examples=200, derandomize=True)
@given(st.dates(), st.dates())
def test_inclusive_length_and_canonical_date_roundtrip(a, b):
    start, end = sorted((a, b))
    assert inclusive_length(start, end) == end.toordinal() - start.toordinal() + 1
    assert parse_iso_date(a.isoformat()) == a


@settings(max_examples=200, derandomize=True)
@given(CHECK_DATES, st.integers(1, 179))
def test_splitting_continuous_coverage_does_not_change_usage(day, split):
    start = day - timedelta(days=179)
    whole = [ShortStay("a", start, day)]
    parts = [
        ShortStay("a", start, start + timedelta(days=split - 1)),
        ShortStay("b", start + timedelta(days=split), day),
    ]
    assert usage_on(whole, day) == usage_on(parts, day)


@settings(max_examples=200, derandomize=True)
@given(interval_cases())
def test_overlap_detection_matches_independent_pairwise_date_sets(case):
    _, intervals = case
    stays = [ShortStay(str(i), value.start, value.end) for i, value in enumerate(intervals)]
    sets = [occupied_set([interval]) for interval in intervals]
    expected_overlap = any(a & b for i, a in enumerate(sets) for b in sets[i + 1 :])
    issues = validate_history(stays)
    assert bool(issues) == expected_overlap
    assert all(issue.code is IssueCode.OVERLAPPING_STAYS for issue in issues)
