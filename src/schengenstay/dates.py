"""Closed calendar intervals and unique coverage, with no travel semantics."""

import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

WINDOW_DAYS = 180
MIN_CHECK_DATE = date.min + timedelta(days=WINDOW_DAYS - 1)


def require_date(value: date, field: str) -> None:
    """Reject datetime (a date subclass) and implicit timezone conversions."""
    if type(value) is not date:
        raise TypeError(f"{field} must be a datetime.date, not a timestamp or string")


def parse_iso_date(value: str) -> date:
    """Parse strictly ASCII YYYY-MM-DD in Python's 0001..9999 calendar range."""
    if not isinstance(value, str):
        raise TypeError("date must be a YYYY-MM-DD string")
    if re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value) is None:
        raise ValueError("date must use the exact YYYY-MM-DD format")
    return date.fromisoformat(value)


@dataclass(frozen=True, slots=True)
class DateInterval:
    """A validated inclusive interval. Adjacent intervals have no unoccupied gap."""

    start: date
    end: date

    def __post_init__(self) -> None:
        require_date(self.start, "start")
        require_date(self.end, "end")
        if self.end < self.start:
            raise ValueError("end must be on or after start")

    @property
    def days(self) -> int:
        return (self.end - self.start).days + 1


def inclusive_length(start: date, end: date) -> int:
    """Count both boundary dates; same-day intervals contain one day."""
    return DateInterval(start, end).days


def rolling_window(day: date) -> DateInterval:
    """Return [day - 179, day]; reject dates without a representable full window."""
    require_date(day, "day")
    if day < MIN_CHECK_DATE:
        raise ValueError(f"day must be >= {MIN_CHECK_DATE.isoformat()} for a full 180-day window")
    return DateInterval(day - timedelta(days=WINDOW_DAYS - 1), day)


def normalize_intervals(intervals: Iterable[DateInterval]) -> tuple[DateInterval, ...]:
    """Union finite validated intervals, sorted and merged, without changing input.

    Overlap resolution here is arithmetic only. User history must be validated
    separately before any result is issued.
    """
    merged: list[DateInterval] = []
    for interval in sorted(intervals, key=lambda item: (item.start, item.end)):
        # Subtract rather than adding a day to the end: date.max must not overflow.
        if merged and (interval.start - merged[-1].end).days <= 1:
            previous = merged[-1]
            merged[-1] = DateInterval(previous.start, max(previous.end, interval.end))
        else:
            merged.append(interval)
    return tuple(merged)


def count_occupied_days(intervals: Iterable[DateInterval], window: DateInterval) -> int:
    """Count unique dates in a window using intersection lengths, not enumeration.

    This low-level arithmetic helper intentionally deduplicates overlaps. It does
    not certify the validity of the original history or identify legal grounds.
    """
    clipped = []
    for interval in intervals:
        start = max(interval.start, window.start)
        end = min(interval.end, window.end)
        if start <= end:
            clipped.append(DateInterval(start, end))
    return sum(interval.days for interval in normalize_intervals(clipped))
