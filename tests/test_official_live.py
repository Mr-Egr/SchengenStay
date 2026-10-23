"""Offline regressions of outputs actually observed in the live Commission UI.

Running this file does not perform a new external comparison. See fixture scope.
"""

import json
from datetime import date, timedelta
from pathlib import Path

import pytest

from schengenstay import OngoingStay, ShortStay, check_history, max_continuous_stay

FIXTURE = json.loads((Path(__file__).parent / "fixtures" / "official_live_2026-10-23.json").read_text())


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda case: case["name"])
def test_observed_official_output(case):
    history = [ShortStay(str(i), date.fromisoformat(a), date.fromisoformat(b))
               for i, (a, b) in enumerate(case["stays"])]
    day = date.fromisoformat(case["day"])
    if case["mode"] == "planning":
        result = max_continuous_stay(history, day, 91, as_of=max(s.exit for s in history))
        assert result.maximum_proven
        assert result.consecutive_days == case["maximum_days"]
        return
    result = check_history(history, day)
    assert result.status == case["status"]
    for key in ("used_days", "window_start", "first_violation_date"):
        if key in case:
            value = getattr(result, key)
            assert (value.isoformat() if type(value) is date else value) == case[key]
    if history[-1].exit == day:
        # The official manual explicitly asks for the check date as an ongoing exit.
        ongoing = [*history[:-1], OngoingStay(history[-1].id, history[-1].entry)]
        open_result = check_history(ongoing, day)
        assert open_result.status == result.status
        assert open_result.snapshot.used_days == result.snapshot.used_days
        assert open_result.first_violation_date == result.first_violation_date
    if "continuation_exit" in case:
        occupied = any(s.entry <= day <= s.exit for s in history)
        arrival = day + timedelta(days=1) if occupied else day
        maximum = max_continuous_stay(history, arrival, 91, as_of=arrival - timedelta(days=1))
        assert maximum.maximum_proven
        assert maximum.latest_compliant_exit.isoformat() == case["continuation_exit"]
