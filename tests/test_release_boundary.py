"""Untrusted JSON regression cases and bounded parser fuzzing, not legal inference."""

import json

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from schengenstay.browser import handle_json
from schengenstay.contracts import ResultStatus


@pytest.mark.parametrize("fragment", [
    '"history_complete":false,"history_complete":true,"scope":"COUNTABLE_SHORT_STAYS"',
    '"scope":"UNKNOWN","scope":"COUNTABLE_SHORT_STAYS","history_complete":true',
    '"history_complete":true,"scope":"COUNTABLE_SHORT_STAYS",'
    '"legal_context":{"kind":"UNKNOWN","kind":"ARITHMETIC_ONLY"}',
])
def test_duplicate_json_fields_cannot_silently_replace_uncertainty(fragment):
    payload = ('{"schema_version":1,"method":"check_history","stays":[], '
               '"as_of":"2024-03-31",' + fragment + '}')
    result = json.loads(handle_json(payload))["result"]
    assert result["status"] == "INVALID_INPUT"
    assert result["issues"][0]["field"] == "json"


JSON_VALUES = st.recursive(
    st.none() | st.booleans() | st.integers() | st.text(max_size=30),
    lambda child: st.lists(child, max_size=5) | st.dictionaries(st.text(max_size=20), child, max_size=5),
    max_leaves=30,
)


@settings(max_examples=300, derandomize=True)
@given(JSON_VALUES, st.sampled_from(["stays", "as_of", "scope", "legal_context", "plan", "scenarios"]))
def test_untrusted_json_fields_always_return_a_structured_result(value, field):
    request = dict(schema_version=1, method="check_plan", stays=[], as_of="2024-03-31",
                   history_complete=False, scope="UNKNOWN",
                   plan={"entry": "2024-04-01", "exit": "2024-04-02"})
    request[field] = value
    envelope = json.loads(handle_json(json.dumps(request)))
    assert envelope["schema_version"] == 1
    assert envelope["result"]["status"] in {status.value for status in ResultStatus}
    assert envelope["result"]["status"] != "WITHIN_RULE"
