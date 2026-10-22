"""Stage 0 packaging and public wire-contract checks, not arithmetic tests."""

import json
from importlib.metadata import version

import pytest

from schengenstay import ResultStatus


def test_installed_distribution_is_available():
    assert version("schengenstay") == "0.1.0"


def test_status_vocabulary_matches_calculation_rules():
    assert {status.value for status in ResultStatus} == {
        "WITHIN_RULE",
        "VIOLATION",
        "INVALID_INPUT",
        "INSUFFICIENT_DATA",
        "OUT_OF_SCOPE",
        "HORIZON_LIMIT",
    }


@pytest.mark.parametrize("status", ResultStatus)
def test_status_survives_json_roundtrip(status):
    payload = json.loads(json.dumps({"status": status}))
    assert payload["status"] == status.value
    assert ResultStatus(payload["status"]) is status


@pytest.mark.parametrize("value", ["VALID_FOR_RULE", "WITHIN_90_180_RULE", "ALLOWED_TO_TRAVEL"])
def test_unagreed_status_names_are_rejected(value):
    with pytest.raises(ValueError):
        ResultStatus(value)
