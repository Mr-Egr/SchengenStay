"""Real JSON boundary parity; no Pyodide/network needed for the Python checks."""

import copy
import json
from datetime import date

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from schengenstay import (
    PlannedStay,
    ShortStay,
    check_history,
    check_plan,
    compare_scenarios,
    find_earliest_entry,
    max_continuous_stay,
    usage_on,
)
from schengenstay.browser import MAX_REQUEST_BYTES, handle_json, serialize
from schengenstay.explanations import ReasonCode
from schengenstay.validation import IssueCode


def request(method="check_history", **extra):
    return dict(schema_version=1, method=method, stays=[], as_of="2024-03-31",
                history_complete=True, scope="COUNTABLE_SHORT_STAYS", **extra)


def result(payload):
    envelope = json.loads(handle_json(json.dumps(payload)))
    assert envelope["schema_version"] == 1
    return envelope["result"]


def test_all_public_functions_match_direct_api():
    stay = ShortStay("a", date(2024, 1, 1), date(2024, 1, 10))
    history = [stay]
    day = date(2024, 3, 31)
    plan = PlannedStay(date(2024, 4, 1), date(2024, 4, 10))
    wire = dict(kind="completed", id="a", entry="2024-01-01", exit="2024-01-10")
    cases = [
        ("check_history", {}, check_history(history, day)),
        ("check_plan", {"plan": {"entry": "2024-04-01", "exit": "2024-04-10"}},
         check_plan(history, plan, as_of=day)),
        ("max_continuous_stay", {"arrival": "2024-04-01", "horizon_days": 91},
         max_continuous_stay(history, plan.entry, 91, as_of=day)),
        ("find_earliest_entry", {"search_start": "2024-04-01", "horizon_days": 365,
                                "length_days": 90},
         find_earliest_entry(history, 90, plan.entry, 365, as_of=day)),
        ("compare_scenarios", {"scenarios": [{"entry": "2024-04-01", "exit": "2024-04-10"}]},
         compare_scenarios(history, [plan], as_of=day)),
    ]
    for method, options, expected in cases:
        payload = {**request(method), **options, "stays": [wire]}
        original = copy.deepcopy(payload)
        assert result(payload) == serialize(expected)
        assert payload == original
    assert result({**request("usage_on"), "stays": [wire]})["snapshot"] == serialize(usage_on(history, day))


@pytest.mark.parametrize("exit,status,days", [("2024-03-30", "WITHIN_RULE", 90), ("2024-03-31", "VIOLATION", 91)])
def test_exact_ninety_and_first_violation(exit, status, days):
    got = result({**request(), "stays": [dict(kind="completed", id="a", entry="2024-01-01", exit=exit)]})
    assert got["status"] == status
    assert got["snapshot"]["used_days"] == days
    if days == 91:
        assert got["first_violation_date"] == "2024-03-31"
        assert got["first_violation"]["window_start"] == "2023-10-04"
        assert got["human_explanation_keys"] == ["compliance.rolling_limit_exceeded"]


@pytest.mark.parametrize("change,status", [
    ({"history_complete": False}, "INSUFFICIENT_DATA"),
    ({"scope": "UNKNOWN"}, "INSUFFICIENT_DATA"),
    ({"scope": "SPECIAL_LEGAL_CONTEXT"}, "OUT_OF_SCOPE"),
    ({"scope": "VISA_VALIDITY"}, "OUT_OF_SCOPE"),
    ({"as_of": "2024-02-30"}, "INVALID_INPUT"),
    ({"as_of": "2024-03-31T00:00:00Z"}, "INVALID_INPUT"),
    ({"as_of": None}, "INSUFFICIENT_DATA"),
    ({"max_inspected_days": True}, "INVALID_INPUT"),
    ({"schema_version": True}, "INVALID_INPUT"),
    ({"schema_version": 2}, "INVALID_INPUT"),
    ({"method": {}}, "INVALID_INPUT"),
    ({"stays": None}, "INSUFFICIENT_DATA"),
    ({"stays": [{}]}, "INVALID_INPUT"),
    ({"scope": "invented"}, "INVALID_INPUT"),
    ({"ongoing_confirmed": "yes"}, "INVALID_INPUT"),
    ({"unexpected": "text"}, "INVALID_INPUT"),
])
def test_invalid_missing_unsupported(change, status):
    got = result({**request(), **change})
    assert got["status"] == status
    assert got.get("snapshot") is None


def test_no_affirmative_defaults_or_usage_for_missing_context():
    for method in ["check_history", "usage_on"]:
        got = result(dict(schema_version=1, method=method, stays=[], as_of="2024-03-31"))
        assert got["status"] == "INSUFFICIENT_DATA"
        assert got.get("snapshot") is None


def test_ongoing_confirmation_and_planning_block():
    payload = {**request(), "stays": [dict(kind="ongoing", id="a", entry="2024-03-01")]}
    assert result(payload)["reason_codes"] == ["ONGOING_CONFIRMATION_REQUIRED"]
    payload["ongoing_confirmed"] = True
    assert result(payload)["snapshot"]["used_days"] == 31
    assert result(payload)["snapshot"]["assumed_ongoing_ids"] == ["a"]
    payload.update(method="check_plan", plan=dict(entry="2024-04-01", exit="2024-04-02"))
    assert result(payload)["reason_codes"] == ["ONGOING_EXIT_REQUIRED"]
    payload["stays"][0]["exit"] = "2024-03-31"
    assert result(payload)["status"] == "INVALID_INPUT"


def test_overlap_duplicate_and_future_errors_survive_serialization():
    trip = dict(kind="completed", id="a", entry="2024-02-28", exit="2024-03-01")
    got = result({**request(), "stays": [trip, trip]})
    assert got["status"] == "INVALID_INPUT"
    assert "DUPLICATE_ID" in [issue["code"] for issue in got["issues"]]
    assert all(issue["field"].startswith("stays") for issue in got["issues"])


def test_partial_search_and_historical_violation_preserved():
    got = result(request("max_continuous_stay", arrival="2024-04-01", horizon_days=20))
    assert got["status"] == got["planning_status"] == "HORIZON_LIMIT"
    assert got["consecutive_days"] == 20
    assert got["maximum_proven"] is False
    payload = {**request("check_plan", plan=dict(entry="2025-01-01", exit="2025-01-02")),
               "as_of": "2024-12-31", "stays": [dict(kind="completed", id="a", entry="2024-01-01", exit="2024-03-31")]}
    got = result(payload)
    assert got["status"] == got["history_result"]["status"] == "VIOLATION"
    assert got["itinerary_result"]["status"] == "WITHIN_RULE"


@pytest.mark.parametrize("payload", ["{", "[]", "null", '{"as_of":NaN}', "x" * (MAX_REQUEST_BYTES + 1), '"\\ud800"'], ids=['syntax', 'array', 'null', 'nan', 'oversize', 'surrogate'])
def test_bad_json_and_size_are_structured(payload):
    assert json.loads(handle_json(payload))["result"]["status"] == "INVALID_INPUT"


@given(st.dates(min_value=date(2000, 1, 1), max_value=date(2099, 12, 31)))
@settings(max_examples=200, derandomize=True)
def test_iso_roundtrip_same_as_python(day):
    payload = {**request(), "as_of": day.isoformat(),
               "stays": [dict(kind="completed", id="a", entry=day.isoformat(), exit=day.isoformat())]}
    assert result(payload) == serialize(check_history([ShortStay("a", day, day)], day))


def test_all_reason_and_issue_codes_have_bilingual_ui_copy():
    from pathlib import Path

    source = (Path(__file__).resolve().parents[1] / "web/scripts/integration-i18n.js").read_text(encoding="utf-8")
    for code in [*ReasonCode, *IssueCode]:
        assert f"{code.value}:" in source


def test_unexpected_engine_errors_are_not_misreported_as_input_errors(monkeypatch):
    def broken(*args, **kwargs):
        raise ValueError("unexpected engine failure")

    monkeypatch.setattr("schengenstay.browser.check_history", broken)
    with pytest.raises(ValueError, match="unexpected engine failure"):
        handle_json(json.dumps(request()))


def test_user_text_is_data_not_executed_code():
    payload = {**request(), "as_of": "__import__('os').environ.clear()"}
    assert result(payload)["status"] == "INVALID_INPUT"
