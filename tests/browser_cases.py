"""CPython reference scenarios used by the real browser parity suite."""

import json
from datetime import date, timedelta

from schengenstay import (
    CalculationScope,
    OngoingStay,
    PlannedStay,
    ShortStay,
    check_history,
    check_plan,
    compare_scenarios,
    find_earliest_entry,
    max_continuous_stay,
    usage_on,
)
from schengenstay.browser import dispatch, serialize
from schengenstay.context import ContextKind


def cases():
    output = []

    def add(name, method, history, day, expected, **extra):
        stays = [dict(kind="ongoing", id=s.id, entry=s.entry.isoformat()) if isinstance(s, OngoingStay)
                 else dict(kind="completed", id=s.id, entry=s.entry.isoformat(), exit=s.exit.isoformat())
                 for s in history]
        output.append(dict(name=name, request=dict(schema_version=1, method=method, stays=stays,
                           as_of=day.isoformat(), history_complete=True, scope="COUNTABLE_SHORT_STAYS",
                           **extra), expected=serialize(expected)))

    day = date(2024, 3, 31)
    ninety = [ShortStay("a", date(2024, 1, 1), date(2024, 3, 30))]
    violation = [ShortStay("a", date(2024, 1, 1), day)]
    multiple = [ShortStay("a", date(2023, 12, 30), date(2024, 1, 2)),
                ShortStay("b", date(2024, 2, 28), date(2024, 3, 1))]
    for name, history in [("ninety", ninety), ("ninety_one", violation), ("multiple", multiple)]:
        add(name, "check_history", history, day, check_history(history, day))
    assessed = check_history(multiple, day)
    add("snapshot", "usage_on", multiple, day, dict(status=assessed.status,
        reason_codes=assessed.reason_codes, snapshot=usage_on(multiple, day),
        history_result=assessed, issues=assessed.issues))
    add("incomplete", "check_history", [], day, check_history([], day, history_complete=False))
    output[-1]["request"]["history_complete"] = False
    add("unsupported", "check_history", [], day, check_history([], day, scope=CalculationScope.VISA_VALIDITY))
    output[-1]["request"]["scope"] = "VISA_VALIDITY"
    add("invalid", "check_history", [], day, check_history([], "2024-02-30"))
    output[-1]["request"]["as_of"] = "2024-02-30"
    add("overlap", "check_history", ninety * 2, day, check_history(ninety * 2, day))
    ongoing = [OngoingStay("open", date(2024, 3, 1))]
    add("ongoing", "check_history", ongoing, day, check_history(ongoing, day), ongoing_confirmed=True)
    future = PlannedStay(date(2025, 1, 1), date(2025, 1, 2))
    add("historical_violation", "check_plan", violation, day,
        check_plan(violation, future, as_of=day), plan=serialize(future))
    add("ongoing_plan", "check_plan", ongoing, day,
        check_plan(ongoing, future, as_of=day), plan=serialize(future), ongoing_confirmed=True)
    arrival = date(2024, 6, 29)
    for horizon in [20, 91]:
        add(f"maximum_{horizon}", "max_continuous_stay", ninety, day,
            max_continuous_stay(ninety, arrival, horizon, as_of=day),
            arrival=arrival.isoformat(), horizon_days=horizon)
    for horizon in [1, 2]:
        start = date(2024, 6, 28)
        add(f"earliest_{horizon}", "find_earliest_entry", ninety, day,
            find_earliest_entry(ninety, 90, start, horizon, as_of=day),
            search_start=start.isoformat(), horizon_days=horizon, length_days=90)
    plans = [PlannedStay(date(2024, 6, 28), date(2024, 6, 28)),
             PlannedStay(date(2024, 6, 29), date(2024, 9, 26))]
    add("comparison", "compare_scenarios", ninety, day,
        compare_scenarios(ninety, plans, as_of=day), scenarios=serialize(plans))
    add("inspection_limit", "check_history", ninety, day,
        check_history(ninety, day, max_inspected_days=1), max_inspected_days=1)
    large = [ShortStay(str(i), date(1700, 1, 1) + timedelta(days=i * 181),
                       date(1700, 1, 1) + timedelta(days=i * 181)) for i in range(500)]
    add("500_records", "check_history", large, day, check_history(large, day))
    # The same new boundary contracts run in native CPython and real Pyodide.
    # Independent status/date/precedence assertions live in test_context.py.
    methods = [
        ("usage_on", {}), ("check_history", {}),
        ("check_plan", {"plan": {"entry": "2024-04-01", "exit": "2024-04-02"}}),
        ("max_continuous_stay", {"arrival": "2024-04-01", "horizon_days": 91}),
        ("find_earliest_entry", {"search_start": "2024-04-01", "length_days": 1, "horizon_days": 1}),
        ("compare_scenarios", {"scenarios": [{"entry": "2024-04-01", "exit": "2024-04-02"}]}),
    ]
    contexts = [{"kind": kind} for kind in ContextKind] + [
        {"kind": "SHORT_STAY_VISA", "valid_from": "2024-02-29", "valid_until": "2024-02-29"},
        {"kind": "SHORT_STAY_VISA", "valid_from": "2024-03-01", "valid_until": "2024-02-29"},
        {"kind": "SHORT_STAY_VISA", "valid_from": "2024-03-01", "valid_until": ""},
    ]
    for index, context in enumerate(contexts):
        for method, extra in methods:
            request = dict(schema_version=1, method=method, stays=[], as_of="2024-03-31",
                           history_complete=True, scope="COUNTABLE_SHORT_STAYS",
                           legal_context=context, **extra)
            output.append(dict(name=f"context_{index}_{method}", request=request,
                               expected=serialize(dispatch(request))))
    return output


if __name__ == "__main__":
    print(json.dumps(cases()))
