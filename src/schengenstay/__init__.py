"""Pure calendar-day arithmetic; no travel authorization or planning verdicts."""

from schengenstay.calculator import usage_on
from schengenstay.contracts import ResultStatus
from schengenstay.models import OngoingStay, ShortStay, UsageResult
from schengenstay.validation import (
    HistoryValidationError,
    IssueCode,
    ValidationIssue,
    validate_history,
)

__all__ = [
    "HistoryValidationError",
    "IssueCode",
    "OngoingStay",
    "ResultStatus",
    "ShortStay",
    "UsageResult",
    "ValidationIssue",
    "usage_on",
    "validate_history",
]
