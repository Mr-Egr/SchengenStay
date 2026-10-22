"""Structural validation of countable history, separate from legal eligibility."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import Literal

from schengenstay.models import HistoryStay, OngoingStay, ShortStay

MAX_HISTORY_STAYS = 500


class IssueCode(StrEnum):
    HISTORY_TYPE = "HISTORY_TYPE"
    HISTORY_LIMIT = "HISTORY_LIMIT"
    STAY_TYPE = "STAY_TYPE"
    INVALID_ID = "INVALID_ID"
    DUPLICATE_ID = "DUPLICATE_ID"
    INVALID_NOTE = "INVALID_NOTE"
    INVALID_DATE = "INVALID_DATE"
    REVERSED_INTERVAL = "REVERSED_INTERVAL"
    AS_OF_REQUIRED = "AS_OF_REQUIRED"
    ONGOING_AFTER_AS_OF = "ONGOING_AFTER_AS_OF"
    OVERLAPPING_STAYS = "OVERLAPPING_STAYS"


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    code: IssueCode
    field: str
    message_key: str
    severity: Literal["error"] = "error"
    related_field: str | None = None


class HistoryValidationError(ValueError):
    """No usage result was computed; issues contain the actionable field paths."""

    def __init__(self, issues: Sequence[ValidationIssue]) -> None:
        self.issues = tuple(issues)
        super().__init__(
            "Invalid history: " + "; ".join(f"{issue.field}: {issue.code}" for issue in self.issues)
        )


def validate_history(
    stays: Sequence[HistoryStay],
    *,
    as_of: date | None = None,
) -> list[ValidationIssue]:
    """Report input issues without reordering or silently resolving user records.

    Ongoing records require an explicit as_of date and assume presence through it.
    Completed records may extend beyond a snapshot date; usage clips their dates.
    Overlaps anywhere in the submitted history are errors, including shared exit/
    entry days. For each conflicting record, report one earlier overlapping witness.
    """
    issues: list[ValidationIssue] = []

    def add(code: IssueCode, field: str, related: str | None = None) -> None:
        issues.append(
            ValidationIssue(
                code,
                field,
                f"validation.{code.value.lower()}",
                related_field=related,
            )
        )

    if not isinstance(stays, Sequence) or isinstance(stays, (str, bytes, bytearray)):
        add(IssueCode.HISTORY_TYPE, "stays")
        return issues
    if len(stays) > MAX_HISTORY_STAYS:
        add(IssueCode.HISTORY_LIMIT, "stays")
        return issues
    if as_of is not None and type(as_of) is not date:
        add(IssueCode.INVALID_DATE, "as_of")
        return issues

    identifiers: dict[str, str] = {}
    intervals: list[tuple[date, date, str]] = []
    for index, stay in enumerate(stays):
        field = f"stays[{index}]"
        if type(stay) not in (ShortStay, OngoingStay):
            add(IssueCode.STAY_TYPE, field)
            continue
        if not isinstance(stay.id, str) or not stay.id.strip():
            add(IssueCode.INVALID_ID, f"{field}.id")
        elif stay.id in identifiers:
            add(IssueCode.DUPLICATE_ID, f"{field}.id", identifiers[stay.id])
        else:
            identifiers[stay.id] = f"{field}.id"

        if isinstance(stay, ShortStay) and not isinstance(stay.note, str):
            add(IssueCode.INVALID_NOTE, f"{field}.note")
        entry_valid = type(stay.entry) is date
        if not entry_valid:
            add(IssueCode.INVALID_DATE, f"{field}.entry")

        if isinstance(stay, OngoingStay):
            if as_of is None:
                add(IssueCode.AS_OF_REQUIRED, field)
                continue
            end = as_of
            if entry_valid and stay.entry > end:
                add(IssueCode.ONGOING_AFTER_AS_OF, f"{field}.entry")
                continue
        else:
            end = stay.exit
            if type(end) is not date:
                add(IssueCode.INVALID_DATE, f"{field}.exit")
                continue
            if entry_valid and stay.entry > end:
                add(IssueCode.REVERSED_INTERVAL, f"{field}.exit", f"{field}.entry")
                continue

        if entry_valid:
            intervals.append((stay.entry, end, field))

    furthest_end: date | None = None
    furthest_field: str | None = None
    for start, end, field in sorted(intervals):
        if furthest_end is not None and start <= furthest_end:
            add(IssueCode.OVERLAPPING_STAYS, field, furthest_field)
        if furthest_end is None or end > furthest_end:
            furthest_end, furthest_field = end, field
    return issues
