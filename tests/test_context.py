"""Conservative legal context cannot manufacture arithmetic or legal success."""

import copy
import json
from datetime import date

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from schengenstay.browser import handle_json, serialize
from schengenstay.context import ContextKind, ContextReason, check_visa_dates, review_context
from schengenstay.contracts import ResultStatus

BASE = dict(schema_version=1, method="check_history", stays=[], as_of="2024-03-31",
            scope="COUNTABLE_SHORT_STAYS", history_complete=True)
METHODS = [
    ("usage_on", {}), ("check_history", {}),
    ("check_plan", {"plan": {"entry": "2024-04-01", "exit": "2024-04-02"}}),
    ("max_continuous_stay", {"arrival": "2024-04-01", "horizon_days": 91}),
    ("find_earliest_entry", {"search_start": "2024-04-01", "length_days": 1, "horizon_days": 1}),
    ("compare_scenarios", {"scenarios": [{"entry": "2024-04-01", "exit": "2024-04-02"}]}),
]


def result(**changes):
    return json.loads(handle_json(json.dumps({**BASE, **changes})))["result"]


@pytest.mark.parametrize("method,extra", METHODS)
@pytest.mark.parametrize("kind", list(ContextKind))
def test_all_contexts_gate_every_public_method_without_reclassifying_history(method, extra, kind):
    context = {"kind": kind}
    before = copy.deepcopy(context)
    got = result(method=method, legal_context=context, **extra)
    assert context == before
    if kind is ContextKind.ARITHMETIC_ONLY:
        legacy = result(method=method, **extra)
        assert got.pop("context_review")["status"] is None
        assert got == legacy
    else:
        status = "INSUFFICIENT_DATA" if kind is ContextKind.UNKNOWN else "OUT_OF_SCOPE"
        assert got["status"] == status
        encoded = json.dumps(got)
        assert '"WITHIN_RULE"' not in encoded
        def no_usage(value):
            if isinstance(value, dict):
                for key, nested in value.items():
                    if key in ("used_days", "remaining_arithmetic_days", "snapshot", "first_violation"):
                        assert nested is None
                    no_usage(nested)
            elif isinstance(value, list):
                for nested in value:
                    no_usage(nested)
        no_usage(got)
        assert got.get("snapshot") is None


@pytest.mark.parametrize("value,status", [
    (None, "INSUFFICIENT_DATA"), ({}, "INSUFFICIENT_DATA"),
    ({"kind": "UNKNOWN"}, "INSUFFICIENT_DATA"), ([], "INVALID_INPUT"),
    ({"kind": []}, "INVALID_INPUT"), ({"kind": "UNRECOGNIZED"}, "INVALID_INPUT"),
    ({"kind": "SHORT_STAY_VISA", "entries": "MULT"}, "INVALID_INPUT"),
    ({"kind": "SHORT_STAY_VISA", "authorised_days": 30}, "INVALID_INPUT"),
    ({"kind": "ARITHMETIC_ONLY", "valid_from": "2024-01-01"}, "INVALID_INPUT"),
])
def test_missing_unknown_and_unsupported_fields_cannot_be_ignored(value, status):
    assert result(legal_context=value)["status"] == status


@pytest.mark.parametrize("start,end,status,code", [
    (None, None, "INSUFFICIENT_DATA", "VISA_DATES_INCOMPLETE"),
    ("2024-01-01", "", "INSUFFICIENT_DATA", "VISA_DATES_INCOMPLETE"),
    ("2024-02-30", "2024-03-01", "INVALID_INPUT", None),
    ("2023-02-29", "2024-03-01", "INVALID_INPUT", None),
    (True, 123, "INVALID_INPUT", None),
    ("2024-01-02", "2024-01-01", "INVALID_INPUT", None),
    ("2024-02-29", "2024-02-29", None, "VISA_DATE_ORDER_ONLY"),
    ("2023-12-31", "2024-01-01", None, "VISA_DATE_ORDER_ONLY"),
    ("0001-01-01", "9999-12-31", None, "VISA_DATE_ORDER_ONLY"),
])
def test_visa_date_consistency_is_not_visa_validity(start, end, status, code):
    check = check_visa_dates(start, end)
    assert check.status == status
    if code:
        assert code in check.reason_codes
    got = result(legal_context={"kind": "SHORT_STAY_VISA", "valid_from": start, "valid_until": end})
    assert got["status"] == ("INVALID_INPUT" if status == "INVALID_INPUT" else "OUT_OF_SCOPE")
    assert got["context_review"]["visa_dates"] == serialize(check)
    assert '"WITHIN_RULE"' not in json.dumps(got)


def test_mixed_history_never_automatically_omits_or_counts_special_periods():
    stays = [dict(kind="completed", id="short", entry="2024-01-01", exit="2024-01-10"),
             dict(kind="completed", id="unclassified", entry="2024-02-01", exit="2024-03-01")]
    before = copy.deepcopy(stays)
    got = result(stays=stays, legal_context={"kind": "MIXED_HISTORY"})
    assert got["status"] == "OUT_OF_SCOPE"
    assert "MIXED_CONTEXT" in got["reason_codes"]
    assert got.get("snapshot") is None
    assert stays == before
    stays[1]["legal_basis"] = "RESIDENCE_PERMIT"
    # Legacy clients cannot bypass this gate by supplying ignored per-stay metadata.
    assert result(stays=stays)["status"] == "INVALID_INPUT"


def test_existing_unknown_incomplete_and_special_scope_cannot_be_overridden():
    context = {"kind": "ARITHMETIC_ONLY"}
    assert result(legal_context=context, history_complete=False)["status"] == "INSUFFICIENT_DATA"
    assert result(legal_context=context, scope="UNKNOWN")["status"] == "INSUFFICIENT_DATA"
    assert result(legal_context=context, scope="SPECIAL_LEGAL_CONTEXT")["status"] == "OUT_OF_SCOPE"
    assert result(legal_context={"kind": "UNKNOWN"}, as_of="bad")["status"] == "INVALID_INPUT"


def test_plan_metadata_and_ongoing_confirmation_are_not_silently_ignored():
    assert result(method="check_plan", plan={"entry": "2024-04-01", "exit": "2024-04-02",
                                           "visa_exempt": True})["status"] == "INVALID_INPUT"
    stays = [dict(kind="ongoing", id="a", entry="2024-03-01")]
    got = result(stays=stays, legal_context={"kind": "ARITHMETIC_ONLY"})
    assert got["status"] == "INSUFFICIENT_DATA"
    assert "ONGOING_CONFIRMATION_REQUIRED" in got["reason_codes"]
    assert result(stays=stays, legal_context={"kind": "RESIDENCE_PERMIT"})["status"] == "OUT_OF_SCOPE"


def test_known_historical_violation_is_unchanged_in_arithmetic_only_mode():
    stays = [dict(kind="completed", id="a", entry="2024-01-01", exit="2024-03-31")]
    got = result(stays=stays, legal_context={"kind": "ARITHMETIC_ONLY"})
    assert got["status"] == "VIOLATION"
    assert got["first_violation_date"] == "2024-03-31"


@given(st.dates(min_value=date.min), st.dates(min_value=date.min))
@settings(max_examples=200, derandomize=True)
def test_date_pair_property_never_produces_a_visa_success(start, end):
    review = review_context({"kind": "SHORT_STAY_VISA", "valid_from": start.isoformat(),
                             "valid_until": end.isoformat()})
    assert review.status is (ResultStatus.INVALID_INPUT if end < start else ResultStatus.OUT_OF_SCOPE)
    assert review.visa_dates.status is (ResultStatus.INVALID_INPUT if end < start else None)


def test_all_context_codes_have_bilingual_copy():
    from pathlib import Path

    source = (Path(__file__).resolve().parents[1] / "web/scripts/context-i18n.js").read_text(encoding="utf-8")
    for code in ContextReason:
        assert f"{code.value}:" in source
