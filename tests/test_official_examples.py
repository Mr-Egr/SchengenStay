"""Offline checks against the cited EC manual, plus labeled derived boundaries."""

import json
from datetime import date, timedelta
from pathlib import Path

import pytest

from schengenstay import PlannedStay, ResultStatus, ShortStay, check_history, check_plan

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "official_examples.json").read_text())


def records(key):
    return [
        ShortStay(str(i), date.fromisoformat(entry), date.fromisoformat(exit))
        for i, (entry, exit) in enumerate(FIXTURE[key])
    ]


@pytest.mark.parametrize("case", FIXTURE["history_cases"])
def test_published_history_snapshot(case):
    result = check_history(records("history_stays"), date.fromisoformat(case["as_of"]))
    assert result.status is ResultStatus(case["status"])
    assert result.used_days == case["used_days"]
    assert result.window_start == date.fromisoformat(case["window_start"])
    assert result.first_violation_date is None


@pytest.mark.parametrize("case", FIXTURE["fixed_itineraries"])
def test_published_duration_as_fixed_itinerary_without_search(case):
    plan = PlannedStay(date.fromisoformat(case["entry"]), date.fromisoformat(case["exit"]))
    result = check_plan(records("planning_history"), plan, as_of=date(2024, 6, 9))
    assert result.status is ResultStatus.WITHIN_RULE
    assert result.itinerary_result.inspected_dates == case["published_length"]
    assert result.itinerary_result.used_days == 90


@pytest.mark.parametrize("case", FIXTURE["fixed_itineraries"])
def test_derived_day_after_published_duration_exceeds_limit(case):
    end = date.fromisoformat(case["exit"]) + timedelta(days=1)
    result = check_plan(
        records("planning_history"),
        PlannedStay(date.fromisoformat(case["entry"]), end),
        as_of=date(2024, 6, 9),
    )
    assert result.status is ResultStatus.VIOLATION
    assert result.itinerary_result.first_violation_date == end
    assert result.itinerary_result.violation_count == 91


def test_derived_first_violation_for_published_history():
    result = check_history(records("history_stays"), date(2024, 9, 20))
    assert result.first_violation_date == date(2024, 8, 30)
    assert result.violation_count == 91
    assert result.snapshot.used_days == 112
