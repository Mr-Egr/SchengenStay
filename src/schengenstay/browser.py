"""Version 1 JSON boundary for the static browser; no new day-rule algorithms."""

import json
from dataclasses import fields, is_dataclass
from datetime import date
from enum import Enum

from schengenstay import (
    CalculationScope,
    CheckResult,
    OngoingStay,
    PlannedStay,
    ReasonCode,
    ResultStatus,
    ShortStay,
    check_history,
    check_plan,
    compare_scenarios,
    find_earliest_entry,
    max_continuous_stay,
    usage_on,
)
from schengenstay.context import review_context
from schengenstay.dates import parse_iso_date
from schengenstay.validation import IssueCode, ValidationIssue

SCHEMA_VERSION = 1
MAX_REQUEST_BYTES = 512_000
METHODS = frozenset({
    "usage_on", "check_history", "check_plan", "max_continuous_stay",
    "find_earliest_entry", "compare_scenarios",
})
PROPERTIES = (
    "human_explanation_keys", "first_violation_date", "violation_count",
    "used_days", "remaining_arithmetic_days", "window_start", "window_end",
)


def serialize(value):
    """Serialize nested results, including documented computed properties."""
    if isinstance(value, Enum):
        return value.value
    if type(value) is date:
        return value.isoformat()
    if is_dataclass(value):
        result = {field.name: serialize(getattr(value, field.name)) for field in fields(value)}
        for name in PROPERTIES:
            if hasattr(type(value), name):
                result[name] = serialize(getattr(value, name))
        return result
    if isinstance(value, (tuple, list)):
        return [serialize(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize(item) for key, item in value.items()}
    return value


def _day(value):
    # Preserve malformed values for the authoritative domain validator.
    try:
        return parse_iso_date(value)
    except (TypeError, ValueError):
        return value


def _history(value):
    if not isinstance(value, list) or len(value) > 500:
        return value
    result = []
    for item in value:
        if not isinstance(item, dict):
            result.append(item)
        elif item.keys() - {"kind", "id", "entry", "exit", "note"}:
            result.append(item)  # Do not drop unrecognized legal/countability metadata.
        elif item.get("kind") == "completed":
            result.append(ShortStay(item.get("id"), _day(item.get("entry")),
                                    _day(item.get("exit")), item.get("note", "")))
        elif item.get("kind") == "ongoing":
            if item.get("exit") is not None:
                result.append(item)  # Contradictory record, never silently discard an exit.
            else:
                result.append(OngoingStay(item.get("id"), _day(item.get("entry"))))
        else:
            result.append(item)
    return result


def _plan(value):
    if isinstance(value, dict) and not value.keys() - {"entry", "exit"}:
        return PlannedStay(_day(value.get("entry")), _day(value.get("exit")))
    return value


def _invalid(field="request"):
    return CheckResult(
        ResultStatus.INVALID_INPUT, None, (ReasonCode.INVALID_REQUEST,),
        issues=(ValidationIssue(IssueCode.INVALID_OPTION, field, "validation.invalid_option"),),
    )


def _dispatch_arithmetic(request):
    """Convert a versioned request and call exactly the existing public APIs.

    Missing scope/completeness never inherits the Python APIs' affirmative defaults.
    usage_on is gated by check_history and returns both the snapshot and history
    assessment. Other methods return their complete native result structure.
    """
    if not isinstance(request, dict) or type(request.get("schema_version")) is not int:
        return _invalid()
    if (request["schema_version"] != SCHEMA_VERSION
            or not isinstance(request.get("method"), str) or request["method"] not in METHODS):
        return _invalid("schema_version_or_method")
    allowed = {"schema_version", "method", "stays", "as_of", "scope", "history_complete",
               "ongoing_confirmed", "max_inspected_days", "plan", "arrival", "horizon_days",
               "length_days", "search_start", "scenarios", "legal_context"}
    if request.keys() - allowed:
        return _invalid()
    scope = request.get("scope")
    try:
        scope = CalculationScope(scope) if scope is not None else None
    except (ValueError, TypeError):
        pass  # Domain layer reports invalid enum values.
    stays = _history(request.get("stays"))
    options = dict(as_of=_day(request.get("as_of")), scope=scope,
                   history_complete=request.get("history_complete", False),
                   max_inspected_days=request.get("max_inspected_days", 10_000))
    confirmation = request.get("ongoing_confirmed", False)
    if type(confirmation) is not bool:
        return _invalid("ongoing_confirmed")
    if isinstance(stays, list) and any(type(item) is OngoingStay for item in stays):
        if not confirmation:
            # Still report malformed input/unsupported scope before missing confirmation.
            checked = check_history(stays, **{**options, "history_complete": False})
            if checked.status in (ResultStatus.INVALID_INPUT, ResultStatus.OUT_OF_SCOPE):
                return checked
            return {
                "status": "INSUFFICIENT_DATA", "reason_codes": ["ONGOING_CONFIRMATION_REQUIRED"],
                "issues": [], "scope_notes": checked.scope_notes,
            }
    method = request["method"]
    if method in ("usage_on", "check_history"):
        result = check_history(stays, **options)
        if method == "check_history":
            return result
        # A snapshot is not a historical compliance verdict, including at an inspection limit.
        snapshot = usage_on(stays, options["as_of"]) if result.snapshot is not None else None
        return {"status": result.status, "reason_codes": result.reason_codes,
                "snapshot": snapshot, "history_result": result, "issues": result.issues}
    if method == "check_plan":
        return check_plan(stays, _plan(request.get("plan")), **options)
    if method == "max_continuous_stay":
        return max_continuous_stay(stays, _day(request.get("arrival")),
                                   request.get("horizon_days"), **options)
    if method == "find_earliest_entry":
        return find_earliest_entry(stays, request.get("length_days"),
                                  _day(request.get("search_start")),
                                  request.get("horizon_days"), **options)
    scenarios = request.get("scenarios")
    if isinstance(scenarios, list) and len(scenarios) <= 100:
        scenarios = [_plan(item) for item in scenarios]
    return compare_scenarios(stays, scenarios, **options)


def dispatch(request):
    """Add optional context gates without changing legacy arithmetic API results.

    A blocking context is passed through the existing scope gate before any
    arithmetic runs. Malformed history/plans still retain validation precedence.
    No record is automatically reclassified or excluded from counting.
    """
    if not isinstance(request, dict) or "legal_context" not in request:
        return _dispatch_arithmetic(request)
    review = review_context(request["legal_context"])
    gated = dict(request)
    if review.status is not None and request.get("scope") in (
        None, "UNKNOWN", "COUNTABLE_SHORT_STAYS",
    ):
        gated["scope"] = ("SPECIAL_LEGAL_CONTEXT"
                          if review.status is ResultStatus.OUT_OF_SCOPE else "UNKNOWN")
    result = serialize(_dispatch_arithmetic(gated))
    if review.status is ResultStatus.INVALID_INPUT:
        result["status"] = "INVALID_INPUT"
    if review.status is not None:
        result["reason_codes"] = list(dict.fromkeys([
            *result.get("reason_codes", []), *serialize(review.reason_codes),
        ]))
        result["issues"] = [*result.get("issues", []), *serialize(review.issues)]
    result["context_review"] = serialize(review)
    return result


def handle_json(payload: str) -> str:
    """Only data crosses this boundary; no user-supplied source is executed."""
    request = None
    result = None
    try:
        if not isinstance(payload, str) or len(payload.encode("utf-8")) > MAX_REQUEST_BYTES:
            result = _invalid("request_size")
        else:
            request = json.loads(payload, parse_constant=_reject_constant,
                                 object_pairs_hook=_unique_object)
    except (ValueError, RecursionError, UnicodeEncodeError):
        result = _invalid("json")
    if result is None:
        result = dispatch(request)
    return json.dumps({"schema_version": SCHEMA_VERSION, "result": serialize(result)},
                      ensure_ascii=True, allow_nan=False, separators=(",", ":"))


def _reject_constant(value):
    raise ValueError("Non-JSON constant")


def _unique_object(pairs):
    """Reject ambiguous duplicate fields, including nested scope declarations."""
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON field")
        result[key] = value
    return result
