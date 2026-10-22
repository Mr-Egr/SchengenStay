"""Immutable Stage 1 inputs and arithmetic output, not legal-status models."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True, slots=True)
class ShortStay:
    """Caller-identified countable completed stay; validate before computation.

    Construction deliberately preserves invalid fields so validate_history can
    report structured issues together instead of failing at the first field.
    """

    id: str
    entry: date
    exit: date
    note: str = ""


@dataclass(frozen=True, slots=True)
class OngoingStay:
    """Caller-identified countable stay with no invented exit date."""

    id: str
    entry: date


type HistoryStay = ShortStay | OngoingStay


@dataclass(frozen=True, slots=True)
class UsageResult:
    """A single-date arithmetic snapshot, without any compliance verdict.

    assumed_ongoing_ids identifies stays assumed present through check_date.
    remaining_arithmetic_days is not a maximum future continuous stay.
    """

    check_date: date
    window_start: date
    window_end: date
    used_days: int
    remaining_arithmetic_days: int
    assumed_ongoing_ids: tuple[str, ...] = ()
    scope_notes: tuple[str, ...] = (
        "Counts only caller-identified countable short-stay dates; not permission to enter or stay.",
        "Arithmetic remaining is a snapshot, not a promise of future continuous stay.",
        "This snapshot does not assess historical violations, visas, or other legal grounds.",
    )
