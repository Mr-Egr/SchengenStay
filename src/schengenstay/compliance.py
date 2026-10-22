"""Bounded, chronological 90/180 arithmetic checks; no travel authorization."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from schengenstay.calculator import SHORT_STAY_DAYS, _history_intervals, _usage_from_intervals
from schengenstay.contracts import ResultStatus
from schengenstay.dates import MIN_CHECK_DATE, DateInterval, normalize_intervals
from schengenstay.explanations import SCOPE_NOTES, CalculationScope, ReasonCode
from schengenstay.models import HistoryStay, OngoingStay, PlannedStay, ShortStay, UsageResult
from schengenstay.validation import IssueCode, ValidationIssue, validate_history

MAX_INSPECTED_DAYS = 10_000


@dataclass(frozen=True, slots=True)
class CheckResult:
    """First-violation evidence and a separate selected-date snapshot.

    Evidence properties describe first_violation when present, otherwise snapshot.
    A VIOLATION proves noncompliance and stops at the first failure. HORIZON_LIMIT
    means the occupied-date scan was incomplete; it is never a passing verdict.
    """

    status: ResultStatus
    check_date: date | None
    reason_codes: tuple[ReasonCode, ...]
    snapshot: UsageResult | None = None
    first_violation: UsageResult | None = None
    inspected_dates: int = 0
    inspected_through: date | None = None
    issues: tuple[ValidationIssue, ...] = ()
    warnings: tuple[ReasonCode, ...] = ()
    scope_notes: tuple[str, ...] = SCOPE_NOTES

    @property
    def first_violation_date(self) -> date | None:
        return self.first_violation.check_date if self.first_violation else None

    @property
    def violation_count(self) -> int | None:
        return self.first_violation.used_days if self.first_violation else None

    @property
    def used_days(self) -> int | None:
        evidence = self.first_violation or self.snapshot
        return evidence.used_days if evidence else None

    @property
    def remaining_arithmetic_days(self) -> int | None:
        evidence = self.first_violation or self.snapshot
        return evidence.remaining_arithmetic_days if evidence else None

    @property
    def window_start(self) -> date | None:
        evidence = self.first_violation or self.snapshot
        return evidence.window_start if evidence else None

    @property
    def window_end(self) -> date | None:
        evidence = self.first_violation or self.snapshot
        return evidence.window_end if evidence else None

    @property
    def human_explanation_keys(self) -> tuple[str, ...]:
        return tuple(
            f"compliance.{code.value.lower()}" for code in self.reason_codes + self.warnings
        )


@dataclass(frozen=True, slots=True)
class PlanResult:
    """Combined status with independently visible actual-history and itinerary results."""

    status: ResultStatus
    reason_codes: tuple[ReasonCode, ...]
    history_result: CheckResult | None = None
    itinerary_result: CheckResult | None = None
    issues: tuple[ValidationIssue, ...] = ()
    scope_notes: tuple[str, ...] = SCOPE_NOTES

    @property
    def human_explanation_keys(self) -> tuple[str, ...]:
        return tuple(f"compliance.{code.value.lower()}" for code in self.reason_codes)


def _issue(code: IssueCode, field: str) -> ValidationIssue:
    return ValidationIssue(code, field, f"validation.{code.value.lower()}")


def _preflight(
    stays: Sequence[HistoryStay] | None,
    as_of: date | None,
    scope: CalculationScope | None,
    history_complete: bool | None,
    max_inspected_days: int,
) -> CheckResult | None:
    """Precedence: invalid input, unsupported scope, missing information, arithmetic."""
    issues = []
    missing = []
    unsupported = []
    reasons = []
    valid_day = as_of if type(as_of) is date else None
    if as_of is None:
        missing.append(ReasonCode.CHECK_DATE_REQUIRED)
    elif type(as_of) is not date:
        issues.append(_issue(IssueCode.INVALID_DATE, "as_of"))
    elif as_of < MIN_CHECK_DATE:
        issues.append(_issue(IssueCode.CHECK_DATE_RANGE, "as_of"))
    if type(max_inspected_days) is not int or not 1 <= max_inspected_days <= MAX_INSPECTED_DAYS:
        issues.append(_issue(IssueCode.INVALID_OPTION, "max_inspected_days"))
    if history_complete is not None and type(history_complete) is not bool:
        issues.append(_issue(IssueCode.INVALID_OPTION, "history_complete"))
    elif history_complete is not True:
        missing.append(ReasonCode.HISTORY_INCOMPLETE)
    if scope is not None and type(scope) is not CalculationScope:
        issues.append(_issue(IssueCode.INVALID_OPTION, "scope"))
    elif scope is None or scope is CalculationScope.UNKNOWN:
        missing.append(ReasonCode.COUNTABILITY_UNKNOWN)
    elif scope is not CalculationScope.COUNTABLE_SHORT_STAYS:
        unsupported.append(ReasonCode.UNSUPPORTED_SCOPE)
    if issues:
        reasons.append(ReasonCode.INVALID_REQUEST)
    if stays is None:
        missing.append(ReasonCode.HISTORY_REQUIRED)
    else:
        history_issues = tuple(
            issue
            for issue in validate_history(stays, as_of=valid_day)
            if issue.code is not IssueCode.AS_OF_REQUIRED
        )
        if history_issues:
            issues.extend(history_issues)
            reasons.append(ReasonCode.INVALID_HISTORY)
        elif any(stay.entry < MIN_CHECK_DATE for stay in stays):
            unsupported.append(ReasonCode.HISTORY_DATE_RANGE_UNSUPPORTED)
    if issues:
        return CheckResult(
            ResultStatus.INVALID_INPUT, valid_day, tuple(reasons), issues=tuple(issues)
        )
    if unsupported:
        return CheckResult(ResultStatus.OUT_OF_SCOPE, valid_day, tuple(unsupported))
    if missing:
        return CheckResult(ResultStatus.INSUFFICIENT_DATA, valid_day, tuple(missing))
    return None


def _scan(
    coverage: Sequence[DateInterval],
    inspected: Sequence[DateInterval],
    day: date,
    max_inspected_days: int,
    warnings: tuple[ReasonCode, ...] = (),
    ongoing_ids: tuple[str, ...] = (),
) -> CheckResult:
    """Inspect occupied days in order, skipping gaps, until first failure or budget."""
    snapshot = _usage_from_intervals(coverage, day, ongoing_ids)
    count = 0
    through = None
    for interval in normalize_intervals(inspected):
        # Ordinals allow inclusive iteration through date.max without overflow.
        for ordinal in range(interval.start.toordinal(), interval.end.toordinal() + 1):
            if count == max_inspected_days:
                return CheckResult(
                    ResultStatus.HORIZON_LIMIT,
                    day,
                    (ReasonCode.INSPECTION_LIMIT_REACHED,),
                    snapshot=snapshot,
                    inspected_dates=count,
                    inspected_through=through,
                    warnings=warnings,
                )
            through = date.fromordinal(ordinal)
            evidence = _usage_from_intervals(coverage, through, ongoing_ids)
            count += 1
            if evidence.used_days > SHORT_STAY_DAYS:
                return CheckResult(
                    ResultStatus.VIOLATION,
                    day,
                    (ReasonCode.ROLLING_LIMIT_EXCEEDED,),
                    snapshot=snapshot,
                    first_violation=evidence,
                    inspected_dates=count,
                    inspected_through=through,
                    warnings=warnings,
                )
    return CheckResult(
        ResultStatus.WITHIN_RULE,
        day,
        (ReasonCode.NO_VIOLATION_FOUND,),
        snapshot=snapshot,
        inspected_dates=count,
        inspected_through=through,
        warnings=warnings,
    )


def check_history(
    stays: Sequence[HistoryStay] | None,
    as_of: date | None = None,
    *,
    scope: CalculationScope | None = CalculationScope.COUNTABLE_SHORT_STAYS,
    history_complete: bool | None = True,
    max_inspected_days: int = MAX_INSPECTED_DAYS,
) -> CheckResult:
    """Check every supplied occupied day through as_of, not just its last window.

    Defaults declare supplied history complete and already identified as countable
    short stays. Pass unknown/incomplete context explicitly; this API cannot infer
    missing travel or assess legal grounds. No current clock is consulted.
    """
    blocked = _preflight(stays, as_of, scope, history_complete, max_inspected_days)
    if blocked:
        return blocked
    intervals = _history_intervals(stays, as_of)
    clipped = tuple(
        DateInterval(interval.start, min(interval.end, as_of))
        for interval in intervals
        if interval.start <= as_of
    )
    ongoing_ids = tuple(sorted(stay.id for stay in stays if isinstance(stay, OngoingStay)))
    warnings = []
    if any(interval.end > as_of for interval in intervals):
        warnings.append(ReasonCode.FUTURE_DATES_IGNORED)
    if ongoing_ids:
        warnings.append(ReasonCode.ONGOING_ASSUMED_THROUGH_CHECK_DATE)
    return _scan(clipped, clipped, as_of, max_inspected_days, tuple(warnings), ongoing_ids)


def check_plan(
    stays: Sequence[HistoryStay] | None,
    plan: PlannedStay | None,
    *,
    as_of: date | None = None,
    scope: CalculationScope | None = CalculationScope.COUNTABLE_SHORT_STAYS,
    history_complete: bool | None = True,
    max_inspected_days: int = MAX_INSPECTED_DAYS,
) -> PlanResult:
    """Check a fixed future itinerary; no maximum-stay or entry-date search.

    Actual completed records must end by as_of, and plan.entry must follow as_of.
    Ongoing history needs a confirmed exit before planning; do not invent one.
    Assume no additional travel between actual history and the proposed itinerary.
    """
    blocked = _preflight(stays, as_of, scope, history_complete, max_inspected_days)
    issues = []
    if plan is not None:
        if type(plan) is not PlannedStay:
            issues.append(_issue(IssueCode.PLAN_TYPE, "plan"))
        else:
            for field in ("entry", "exit"):
                if type(getattr(plan, field)) is not date:
                    issues.append(_issue(IssueCode.INVALID_DATE, f"plan.{field}"))
            if not issues:
                if plan.exit < plan.entry:
                    issues.append(_issue(IssueCode.REVERSED_INTERVAL, "plan.exit"))
                if type(as_of) is date and plan.entry <= as_of:
                    issues.append(_issue(IssueCode.PLAN_NOT_FUTURE, "plan.entry"))
    if issues:
        if blocked and blocked.status is ResultStatus.INVALID_INPUT:
            issues.extend(blocked.issues)
        return PlanResult(
            ResultStatus.INVALID_INPUT, (ReasonCode.INVALID_REQUEST,), issues=tuple(issues)
        )
    if blocked:
        return PlanResult(
            blocked.status, blocked.reason_codes, history_result=blocked, issues=blocked.issues
        )
    if plan is None:
        return PlanResult(ResultStatus.INSUFFICIENT_DATA, (ReasonCode.PLAN_REQUIRED,))
    future_issues = tuple(
        _issue(IssueCode.HISTORY_AFTER_AS_OF, f"stays[{i}].exit")
        for i, stay in enumerate(stays)
        if isinstance(stay, ShortStay) and stay.exit > as_of
    )
    if future_issues:
        return PlanResult(
            ResultStatus.INVALID_INPUT, (ReasonCode.INVALID_HISTORY,), issues=future_issues
        )
    if any(isinstance(stay, OngoingStay) for stay in stays):
        return PlanResult(ResultStatus.INSUFFICIENT_DATA, (ReasonCode.ONGOING_EXIT_REQUIRED,))

    history = check_history(
        stays,
        as_of,
        scope=scope,
        history_complete=history_complete,
        max_inspected_days=max_inspected_days,
    )
    if history.status not in (ResultStatus.WITHIN_RULE, ResultStatus.VIOLATION):
        return PlanResult(history.status, history.reason_codes, history_result=history)
    return _evaluate_plan(_history_intervals(stays, as_of), plan, history, max_inspected_days)


def _evaluate_plan(
    intervals: Sequence[DateInterval],
    plan: PlannedStay,
    history: CheckResult,
    max_inspected_days: int,
) -> PlanResult:
    """Evaluate a validated future plan against already checked, immutable history.

    Shared with bounded searches; callers must validate through check_plan first.
    Reusing history evidence avoids rescanning the past for every candidate.
    """
    proposed = DateInterval(plan.entry, plan.exit)
    coverage = (*intervals, proposed)
    itinerary = _scan(
        coverage,
        (proposed,),
        plan.exit,
        max_inspected_days,
        (ReasonCode.NO_ADDITIONAL_TRAVEL_ASSUMED,),
    )
    reasons = []
    if history.status is ResultStatus.VIOLATION:
        reasons.append(ReasonCode.HISTORICAL_VIOLATION)
    if itinerary.status is ResultStatus.VIOLATION:
        reasons.append(ReasonCode.ITINERARY_VIOLATION)
    if itinerary.status is ResultStatus.HORIZON_LIMIT:
        reasons.append(ReasonCode.INSPECTION_LIMIT_REACHED)
    status = (
        ResultStatus.VIOLATION if ReasonCode.HISTORICAL_VIOLATION in reasons else itinerary.status
    )
    return PlanResult(
        status, tuple(reasons) or (ReasonCode.NO_VIOLATION_FOUND,), history, itinerary
    )
