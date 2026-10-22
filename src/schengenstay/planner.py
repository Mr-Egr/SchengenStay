"""Finite, deterministic travel searches; results never authorize travel."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date

from schengenstay.calculator import SHORT_STAY_DAYS, _history_intervals
from schengenstay.compliance import (
    MAX_INSPECTED_DAYS,
    CheckResult,
    PlanResult,
    _evaluate_plan,
    _issue,
    check_plan,
)
from schengenstay.contracts import ResultStatus
from schengenstay.dates import MIN_CHECK_DATE
from schengenstay.explanations import SCOPE_NOTES, CalculationScope, ReasonCode
from schengenstay.models import HistoryStay, PlannedStay
from schengenstay.validation import IssueCode, ValidationIssue

MAX_HORIZON_DAYS = 10_000
MAX_TRIP_DAYS = 10_000
MAX_SCENARIOS = 100


@dataclass(frozen=True, slots=True, kw_only=True)
class _SearchResult:
    status: ResultStatus
    planning_status: ResultStatus
    reason_codes: tuple[ReasonCode, ...]
    history_result: CheckResult | None = None
    evaluation: PlanResult | None = None
    issues: tuple[ValidationIssue, ...] = ()
    scope_notes: tuple[str, ...] = SCOPE_NOTES

    @property
    def human_explanation_keys(self) -> tuple[str, ...]:
        return tuple(f"planner.{code.value.lower()}" for code in self.reason_codes)


@dataclass(frozen=True, slots=True, kw_only=True)
class MaxStayResult(_SearchResult):
    """A proven maximum, or just the inspected compliant prefix if limited.

    evaluation describes the probe, which can include the first failing day.
    planning_status describes the returned prefix; status also preserves history.
    None consecutive_days means no planning scan; zero means arrival failed.
    """

    arrival: date | None = None
    search_horizon_end: date | None = None
    latest_compliant_exit: date | None = None
    consecutive_days: int | None = None
    maximum_proven: bool = False

    @property
    def first_violation_date(self) -> date | None:
        itinerary = self.evaluation.itinerary_result if self.evaluation else None
        return itinerary.first_violation_date if itinerary else None


@dataclass(frozen=True, slots=True, kw_only=True)
class EntrySearchResult(_SearchResult):
    """First fully checked itinerary, or an explicit bounded/blocked outcome.

    evaluation is the found itinerary or the last attempted candidate. A failing
    last candidate does not prove all future entries impossible. Only the
    TRIP_LENGTH_EXCEEDS_LIMIT proof sets arithmetic_impossible.
    """

    length_days: int | None = None
    search_start: date | None = None
    search_horizon_end: date | None = None
    entry: date | None = None
    exit: date | None = None
    candidates_checked: int = 0
    inspected_plan_days: int = 0
    arithmetic_impossible: bool = False


@dataclass(frozen=True, slots=True)
class ScenarioResult:
    index: int
    plan: PlannedStay | None
    result: PlanResult


@dataclass(frozen=True, slots=True)
class ComparisonResult:
    """Ordered independent fixed-trip results, with a conservative aggregate status."""

    status: ResultStatus
    reason_codes: tuple[ReasonCode, ...]
    scenarios: tuple[ScenarioResult, ...] = ()
    issues: tuple[ValidationIssue, ...] = ()
    scope_notes: tuple[str, ...] = SCOPE_NOTES

    @property
    def human_explanation_keys(self) -> tuple[str, ...]:
        return tuple(f"planner.{code.value.lower()}" for code in self.reason_codes)


def _search_issues(start, start_field, horizon_days, length_days=1):
    issues = []
    if type(start) is not date:
        issues.append(_issue(IssueCode.INVALID_DATE, start_field))
    elif start < MIN_CHECK_DATE:
        issues.append(_issue(IssueCode.CHECK_DATE_RANGE, start_field))
    for field, value, cap in (
        ("length_days", length_days, MAX_TRIP_DAYS),
        ("horizon_days", horizon_days, MAX_HORIZON_DAYS),
    ):
        if type(value) is not int or not 1 <= value <= cap:
            issues.append(_issue(IssueCode.INVALID_OPTION, field))
    if not issues and start.toordinal() + horizon_days + length_days - 2 > date.max.toordinal():
        issues.append(_issue(IssueCode.CHECK_DATE_RANGE, "horizon_days"))
    return tuple(issues)


def _invalid(issues):
    return dict(
        status=ResultStatus.INVALID_INPUT,
        planning_status=ResultStatus.INVALID_INPUT,
        reason_codes=(ReasonCode.INVALID_REQUEST,),
        issues=issues,
    )


def _context(evaluation, planning_status=None, reasons=None):
    """Preserve the existing combined-history precedence in search results."""
    planning_status = planning_status or evaluation.status
    reasons = reasons if reasons is not None else evaluation.reason_codes
    history = evaluation.history_result
    historical_failure = history is not None and history.status is ResultStatus.VIOLATION
    if historical_failure and ReasonCode.HISTORICAL_VIOLATION not in reasons:
        reasons = (ReasonCode.HISTORICAL_VIOLATION, *reasons)
    return dict(
        status=ResultStatus.VIOLATION if historical_failure else planning_status,
        planning_status=planning_status,
        reason_codes=reasons,
        history_result=history,
        evaluation=evaluation,
        issues=evaluation.issues,
    )


def max_continuous_stay(
    stays: Sequence[HistoryStay] | None,
    arrival: date,
    horizon_days: int,
    *,
    as_of: date | None = None,
    scope: CalculationScope | None = CalculationScope.COUNTABLE_SHORT_STAYS,
    history_complete: bool | None = True,
    max_inspected_days: int = MAX_INSPECTED_DAYS,
) -> MaxStayResult:
    """Inspect a continuous proposal until its first violation or explicit bound.

    horizon_days includes arrival. A passing bounded prefix is HORIZON_LIMIT,
    never an unproven maximum. Inspection budgets apply separately to history
    and the proposal, as in check_plan. An ongoing stay needs a confirmed exit.
    """
    issues = _search_issues(arrival, "arrival", horizon_days)
    if issues:
        return MaxStayResult(**_invalid(issues))
    end = date.fromordinal(arrival.toordinal() + horizon_days - 1)
    evaluation = check_plan(
        stays,
        PlannedStay(arrival, end),
        as_of=as_of,
        scope=scope,
        history_complete=history_complete,
        max_inspected_days=max_inspected_days,
    )
    fields = dict(arrival=arrival, search_horizon_end=end)
    itinerary = evaluation.itinerary_result
    if itinerary is None:
        return MaxStayResult(**_context(evaluation), **fields)
    failure = itinerary.first_violation_date
    length = itinerary.inspected_dates - (1 if failure else 0)
    if failure:
        status = ResultStatus.WITHIN_RULE if length else ResultStatus.VIOLATION
        reason = ReasonCode.MAXIMUM_STAY_FOUND if length else ReasonCode.ENTRY_DATE_EXCEEDS_LIMIT
    else:
        status = ResultStatus.HORIZON_LIMIT
        reason = (
            ReasonCode.INSPECTION_LIMIT_REACHED
            if itinerary.status is ResultStatus.HORIZON_LIMIT
            else ReasonCode.SEARCH_HORIZON_REACHED
        )
    return MaxStayResult(
        **_context(evaluation, status, (reason,)),
        **fields,
        latest_compliant_exit=date.fromordinal(arrival.toordinal() + length - 1)
        if length
        else None,
        consecutive_days=length,
        maximum_proven=failure is not None,
    )


def find_earliest_entry(
    stays: Sequence[HistoryStay] | None,
    length_days: int,
    search_start: date,
    horizon_days: int,
    *,
    as_of: date | None = None,
    scope: CalculationScope | None = CalculationScope.COUNTABLE_SHORT_STAYS,
    history_complete: bool | None = True,
    max_inspected_days: int = MAX_INSPECTED_DAYS,
) -> EntrySearchResult:
    """Test entry candidates in order, checking every day of each proposed trip.

    Horizon includes search_start and bounds entries, not exits. All possible
    departures in that horizon must fit datetime.date. The plan inspection
    budget is shared across candidates; an uncertain earlier candidate stops
    the search. History is checked once with its own equal inspection budget.
    """
    issues = _search_issues(search_start, "search_start", horizon_days, length_days)
    if issues:
        return EntrySearchResult(**_invalid(issues))
    start_ordinal = search_start.toordinal()
    fields = dict(
        length_days=length_days,
        search_start=search_start,
        search_horizon_end=date.fromordinal(start_ordinal + horizon_days - 1),
    )
    proposal = PlannedStay(search_start, date.fromordinal(start_ordinal + length_days - 1))
    evaluation = check_plan(
        stays,
        proposal,
        as_of=as_of,
        scope=scope,
        history_complete=history_complete,
        max_inspected_days=max_inspected_days,
    )
    if evaluation.itinerary_result is None:
        return EntrySearchResult(**_context(evaluation), **fields)
    intervals = _history_intervals(stays, as_of)
    history = evaluation.history_result
    inspected = 0
    for offset in range(horizon_days):
        if offset:
            proposal = PlannedStay(
                date.fromordinal(start_ordinal + offset),
                date.fromordinal(start_ordinal + offset + length_days - 1),
            )
            evaluation = _evaluate_plan(
                intervals, proposal, history, max_inspected_days - inspected
            )
        itinerary = evaluation.itinerary_result
        inspected += itinerary.inspected_dates
        counts = dict(candidates_checked=offset + 1, inspected_plan_days=inspected)
        if itinerary.status is ResultStatus.WITHIN_RULE:
            return EntrySearchResult(
                **_context(
                    evaluation, ResultStatus.WITHIN_RULE, (ReasonCode.EARLIEST_ENTRY_FOUND,)
                ),
                **fields,
                **counts,
                entry=proposal.entry,
                exit=proposal.exit,
            )
        if itinerary.status is ResultStatus.HORIZON_LIMIT:
            reason = ReasonCode.INSPECTION_LIMIT_REACHED
            break
        if length_days > SHORT_STAY_DAYS:
            # Any 91 consecutive days alone occupy >90 days in a 180-day window.
            # This proof concerns continuous countable travel, never legal permission.
            return EntrySearchResult(
                **_context(
                    evaluation, ResultStatus.VIOLATION, (ReasonCode.TRIP_LENGTH_EXCEEDS_LIMIT,)
                ),
                **fields,
                **counts,
                arithmetic_impossible=True,
            )
        if offset == horizon_days - 1:
            reason = ReasonCode.NOT_FOUND_WITHIN_HORIZON
            break
        if inspected == max_inspected_days:
            reason = ReasonCode.INSPECTION_LIMIT_REACHED
            break
    return EntrySearchResult(
        **_context(evaluation, ResultStatus.HORIZON_LIMIT, (reason,)),
        **fields,
        **counts,
    )


def compare_scenarios(
    stays: Sequence[HistoryStay] | None,
    scenarios: Sequence[PlannedStay],
    *,
    as_of: date | None = None,
    scope: CalculationScope | None = CalculationScope.COUNTABLE_SHORT_STAYS,
    history_complete: bool | None = True,
    max_inspected_days: int = MAX_INSPECTED_DAYS,
) -> ComparisonResult:
    """Evaluate 1-100 alternatives independently through the public fixed-trip API.

    A scenario never contributes occupied days to another scenario or to history.
    Each has its own check_plan inspection budgets. Aggregate precedence is
    invalid > unsupported > insufficient > violation > limited > within rule;
    callers should present the individual results, not only this summary.
    """
    if (
        not isinstance(scenarios, Sequence)
        or isinstance(scenarios, (str, bytes, bytearray))
        or not 1 <= len(scenarios) <= MAX_SCENARIOS
    ):
        return ComparisonResult(
            ResultStatus.INVALID_INPUT,
            (ReasonCode.INVALID_REQUEST,),
            issues=(_issue(IssueCode.INVALID_OPTION, "scenarios"),),
        )
    results = tuple(
        ScenarioResult(
            i,
            plan if type(plan) is PlannedStay else None,
            check_plan(
                stays,
                plan,
                as_of=as_of,
                scope=scope,
                history_complete=history_complete,
                max_inspected_days=max_inspected_days,
            ),
        )
        for i, plan in enumerate(scenarios)
    )
    statuses = {item.result.status for item in results}
    status = next(
        value
        for value in (
            ResultStatus.INVALID_INPUT,
            ResultStatus.OUT_OF_SCOPE,
            ResultStatus.INSUFFICIENT_DATA,
            ResultStatus.VIOLATION,
            ResultStatus.HORIZON_LIMIT,
            ResultStatus.WITHIN_RULE,
        )
        if value in statuses
    )
    reasons = tuple(
        dict.fromkeys(
            reason
            for item in results
            if item.result.status is status
            for reason in item.result.reason_codes
        )
    )
    return ComparisonResult(status, reasons, results)
