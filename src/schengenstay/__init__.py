"""Pure calendar-day arithmetic and compliance; no legal travel authorization."""

from schengenstay.calculator import usage_on
from schengenstay.compliance import CheckResult, PlanResult, check_history, check_plan
from schengenstay.contracts import ResultStatus
from schengenstay.explanations import CalculationScope, ReasonCode
from schengenstay.models import OngoingStay, PlannedStay, ShortStay, UsageResult
from schengenstay.planner import (
    ComparisonResult,
    EntrySearchResult,
    MaxStayResult,
    ScenarioResult,
    compare_scenarios,
    find_earliest_entry,
    max_continuous_stay,
)
from schengenstay.validation import (
    HistoryValidationError,
    IssueCode,
    ValidationIssue,
    validate_history,
)

__all__ = [
    "CalculationScope",
    "CheckResult",
    "ComparisonResult",
    "EntrySearchResult",
    "MaxStayResult",
    "ScenarioResult",
    "HistoryValidationError",
    "IssueCode",
    "OngoingStay",
    "PlannedStay",
    "PlanResult",
    "ReasonCode",
    "ResultStatus",
    "ShortStay",
    "UsageResult",
    "ValidationIssue",
    "check_history",
    "check_plan",
    "compare_scenarios",
    "find_earliest_entry",
    "max_continuous_stay",
    "usage_on",
    "validate_history",
]
