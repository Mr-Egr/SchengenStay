"""Conservative context gates and visa date-entry consistency, never legal approval.

Source scope: docs/LEGAL_CONTEXT.md. No occupancy, visa-duration, entry-use or
residence-authorisation calculation belongs in this module.
"""

from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from schengenstay.contracts import ResultStatus
from schengenstay.dates import parse_iso_date
from schengenstay.validation import IssueCode, ValidationIssue


class ContextKind(StrEnum):
    ARITHMETIC_ONLY = "ARITHMETIC_ONLY"
    UNKNOWN = "UNKNOWN"
    SHORT_STAY_VISA = "SHORT_STAY_VISA"
    LONG_STAY_VISA = "LONG_STAY_VISA"
    RESIDENCE_PERMIT = "RESIDENCE_PERMIT"
    PENDING_APPLICATION = "PENDING_APPLICATION"
    NATIONAL_EXTENSION = "NATIONAL_EXTENSION"
    BILATERAL_ARRANGEMENT = "BILATERAL_ARRANGEMENT"
    MIXED_HISTORY = "MIXED_HISTORY"
    OTHER = "OTHER"


class ContextReason(StrEnum):
    ARITHMETIC_ONLY = "ARITHMETIC_ONLY"
    LEGAL_CONTEXT_UNKNOWN = "LEGAL_CONTEXT_UNKNOWN"
    VISA_CONDITIONS_NOT_ASSESSED = "VISA_CONDITIONS_NOT_ASSESSED"
    LONG_STAY_CONTEXT = "LONG_STAY_CONTEXT"
    RESIDENCE_CONTEXT = "RESIDENCE_CONTEXT"
    PENDING_CONTEXT = "PENDING_CONTEXT"
    EXTENSION_CONTEXT = "EXTENSION_CONTEXT"
    BILATERAL_CONTEXT = "BILATERAL_CONTEXT"
    MIXED_CONTEXT = "MIXED_CONTEXT"
    OTHER_CONTEXT = "OTHER_CONTEXT"
    INVALID_LEGAL_CONTEXT = "INVALID_LEGAL_CONTEXT"
    VISA_DATES_INCOMPLETE = "VISA_DATES_INCOMPLETE"
    VISA_DATE_ORDER_ONLY = "VISA_DATE_ORDER_ONLY"


@dataclass(frozen=True, slots=True)
class VisaDateCheck:
    # None means no structural error, NOT WITHIN_RULE or valid visa/travel.
    status: ResultStatus | None
    reason_codes: tuple[ContextReason, ...]
    valid_from: date | None = None
    valid_until: date | None = None
    issues: tuple[ValidationIssue, ...] = ()


@dataclass(frozen=True, slots=True)
class ContextReview:
    # None permits the separate arithmetic gate; it is not a legal assessment.
    status: ResultStatus | None
    kind: ContextKind | None
    reason_codes: tuple[ContextReason, ...]
    issues: tuple[ValidationIssue, ...] = ()
    visa_dates: VisaDateCheck | None = None


def _issue(code, field):
    return ValidationIssue(code, field, f"validation.{code.value.lower()}")


def check_visa_dates(valid_from=None, valid_until=None) -> VisaDateCheck:
    """Validate two ISO sticker dates and their order, without testing travel.

    Same-day bounds are structurally consistent. Missing bounds do not imply
    open-ended validity. No history is assigned to a visa; no grace is inferred.
    """
    parsed, issues = [], []
    for name, value in (("valid_from", valid_from), ("valid_until", valid_until)):
        if value is None or value == "":
            parsed.append(None)
        else:
            try:
                parsed.append(parse_iso_date(value))
            except (TypeError, ValueError):
                parsed.append(None)
                issues.append(_issue(IssueCode.INVALID_DATE, f"legal_context.{name}"))
    start, end = parsed
    if start and end and end < start:
        issues.append(_issue(IssueCode.REVERSED_INTERVAL, "legal_context.valid_until"))
    if issues:
        return VisaDateCheck(ResultStatus.INVALID_INPUT, (), start, end, tuple(issues))
    if start is None or end is None:
        return VisaDateCheck(ResultStatus.INSUFFICIENT_DATA,
                             (ContextReason.VISA_DATES_INCOMPLETE,), start, end)
    return VisaDateCheck(None, (ContextReason.VISA_DATE_ORDER_ONLY,), start, end)


def review_context(value) -> ContextReview:
    """Review an explicitly supplied context object, independently of day counts."""
    invalid = ContextReview(ResultStatus.INVALID_INPUT, None,
                            (ContextReason.INVALID_LEGAL_CONTEXT,),
                            (_issue(IssueCode.INVALID_OPTION, "legal_context"),))
    if value is None:
        return ContextReview(ResultStatus.INSUFFICIENT_DATA, None,
                             (ContextReason.LEGAL_CONTEXT_UNKNOWN,))
    if not isinstance(value, dict) or value.keys() - {"kind", "valid_from", "valid_until"}:
        return invalid
    if value.get("kind") is None:
        return ContextReview(ResultStatus.INSUFFICIENT_DATA, None,
                             (ContextReason.LEGAL_CONTEXT_UNKNOWN,))
    try:
        kind = ContextKind(value["kind"])
    except (TypeError, ValueError):
        return invalid
    has_dates = "valid_from" in value or "valid_until" in value
    if has_dates and kind is not ContextKind.SHORT_STAY_VISA:
        return invalid  # Never discard supplied visa facts when a different mode is selected.
    visa = check_visa_dates(value.get("valid_from"), value.get("valid_until")) if has_dates else None
    if visa and visa.status is ResultStatus.INVALID_INPUT:
        return ContextReview(ResultStatus.INVALID_INPUT, kind,
                             (ContextReason.INVALID_LEGAL_CONTEXT,), visa.issues, visa)
    if kind is ContextKind.ARITHMETIC_ONLY:
        return ContextReview(None, kind, (ContextReason.ARITHMETIC_ONLY,))
    if kind is ContextKind.UNKNOWN:
        return ContextReview(ResultStatus.INSUFFICIENT_DATA, kind,
                             (ContextReason.LEGAL_CONTEXT_UNKNOWN,))
    reason = {
        ContextKind.SHORT_STAY_VISA: ContextReason.VISA_CONDITIONS_NOT_ASSESSED,
        ContextKind.LONG_STAY_VISA: ContextReason.LONG_STAY_CONTEXT,
        ContextKind.RESIDENCE_PERMIT: ContextReason.RESIDENCE_CONTEXT,
        ContextKind.PENDING_APPLICATION: ContextReason.PENDING_CONTEXT,
        ContextKind.NATIONAL_EXTENSION: ContextReason.EXTENSION_CONTEXT,
        ContextKind.BILATERAL_ARRANGEMENT: ContextReason.BILATERAL_CONTEXT,
        ContextKind.MIXED_HISTORY: ContextReason.MIXED_CONTEXT,
        ContextKind.OTHER: ContextReason.OTHER_CONTEXT,
    }[kind]
    return ContextReview(ResultStatus.OUT_OF_SCOPE, kind, (reason,), visa_dates=visa)
