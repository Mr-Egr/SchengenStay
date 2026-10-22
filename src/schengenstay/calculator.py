"""Single-date usage arithmetic only; compliance and planning belong to later stages."""

from collections.abc import Sequence
from datetime import date

from schengenstay.dates import DateInterval, count_occupied_days, rolling_window
from schengenstay.models import HistoryStay, OngoingStay, UsageResult
from schengenstay.validation import HistoryValidationError, validate_history

SHORT_STAY_DAYS = 90


def usage_on(stays: Sequence[HistoryStay], day: date) -> UsageResult:
    """Count unique occupied days in [day - 179, day] after structural validation.

    Dates must already be identified by the caller as countable short-stay dates.
    Invalid history raises HistoryValidationError; no partial count is returned.
    Ongoing stays are assumed present through the explicit day, recorded in the
    result's assumed_ongoing_ids. The caller's records are never altered.
    """
    window = rolling_window(day)
    issues = validate_history(stays, as_of=day)
    if issues:
        raise HistoryValidationError(issues)

    intervals = [
        DateInterval(stay.entry, day if isinstance(stay, OngoingStay) else stay.exit)
        for stay in stays
    ]
    used = count_occupied_days(intervals, window)
    return UsageResult(
        check_date=day,
        window_start=window.start,
        window_end=window.end,
        used_days=used,
        remaining_arithmetic_days=max(0, SHORT_STAY_DAYS - used),
        assumed_ongoing_ids=tuple(
            sorted(stay.id for stay in stays if isinstance(stay, OngoingStay))
        ),
    )
