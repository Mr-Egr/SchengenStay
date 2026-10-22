"""Malformed and contradictory history must never silently become a result."""

from dataclasses import FrozenInstanceError
from datetime import date, datetime, timedelta

import pytest

from schengenstay import OngoingStay, ShortStay, usage_on, validate_history
from schengenstay.validation import MAX_HISTORY_STAYS, HistoryValidationError, IssueCode

D = date(2024, 1, 1)


def codes(stays, **kwargs):
    return {issue.code for issue in validate_history(stays, **kwargs)}


def test_empty_and_unsorted_history_are_valid_and_not_reordered():
    stays = [ShortStay("b", date(2024, 2, 1), date(2024, 2, 2)), ShortStay("a", D, D)]
    original = list(stays)
    assert validate_history([]) == []
    assert validate_history(stays) == []
    assert stays == original


@pytest.mark.parametrize("stays", [None, "text", {}, iter(())])
def test_history_requires_a_bounded_sequence(stays):
    assert codes(stays) == {IssueCode.HISTORY_TYPE}


def test_history_limit_is_explicit():
    stays = [ShortStay(str(i), D, D) for i in range(MAX_HISTORY_STAYS + 1)]
    assert codes(stays) == {IssueCode.HISTORY_LIMIT}


def test_maximum_supported_history_is_accepted():
    stays = [
        ShortStay(str(i), D + timedelta(days=i), D + timedelta(days=i))
        for i in range(MAX_HISTORY_STAYS)
    ]
    assert validate_history(stays) == []
    assert usage_on(stays, stays[-1].exit).used_days == 180


@pytest.mark.parametrize("record", [None, {}, {"entry": D, "exit": D}, 1])
def test_record_type_is_explicit(record):
    assert codes([record]) == {IssueCode.STAY_TYPE}


@pytest.mark.parametrize("identifier", ["", "  ", None, 1])
def test_id_must_be_nonempty_text(identifier):
    assert IssueCode.INVALID_ID in codes([ShortStay(identifier, D, D)])


def test_duplicate_ids_are_rejected_even_for_disjoint_stays():
    assert codes([ShortStay("a", D, D), ShortStay("a", date(2024, 2, 1), date(2024, 2, 1))]) == {
        IssueCode.DUPLICATE_ID,
    }


def test_repeated_record_reports_both_id_and_coverage_errors():
    stay = ShortStay("a", D, D)
    assert codes([stay, stay]) == {IssueCode.DUPLICATE_ID, IssueCode.OVERLAPPING_STAYS}


def test_note_must_be_text_and_does_not_affect_arithmetic():
    assert codes([ShortStay("a", D, D, note=42)]) == {IssueCode.INVALID_NOTE}
    assert usage_on([ShortStay("a", D, D, note="<script>literal data</script>")], D).used_days == 1


@pytest.mark.parametrize("value", [None, "2024-01-01", datetime(2024, 1, 1)])
def test_invalid_date_fields_have_actionable_paths(value):
    issues = validate_history([ShortStay("a", value, value)])
    assert {issue.code for issue in issues} == {IssueCode.INVALID_DATE}
    assert {issue.field for issue in issues} == {"stays[0].entry", "stays[0].exit"}
    assert all(issue.severity == "error" and issue.message_key for issue in issues)


def test_reversed_dates_have_explicit_issue():
    assert codes([ShortStay("a", date(2024, 2, 1), D)]) == {IssueCode.REVERSED_INTERVAL}


@pytest.mark.parametrize(("start", "end"), [(1, 10), (4, 6), (10, 12)])
def test_duplicate_nested_and_shared_border_days_are_overlaps(start, end):
    stays = [
        ShortStay("a", D, date(2024, 1, 10)),
        ShortStay("b", date(2024, 1, start), date(2024, 1, end)),
    ]
    issues = validate_history(stays)
    assert len(issues) == 1
    assert issues[0].code is IssueCode.OVERLAPPING_STAYS
    assert issues[0].related_field is not None
    with pytest.raises(HistoryValidationError) as error:
        usage_on(stays, date(2024, 1, 15))
    assert error.value.issues == tuple(issues)


def test_overlap_sweep_keeps_long_enclosing_interval():
    stays = [
        ShortStay("a", D, date(2024, 1, 20)),
        ShortStay("b", date(2024, 1, 2), date(2024, 1, 3)),
        ShortStay("c", date(2024, 1, 10), date(2024, 1, 11)),
    ]
    assert len(validate_history(stays)) == 2


def test_adjacent_days_are_valid_separate_history():
    assert (
        validate_history([ShortStay("a", D, D), ShortStay("b", date(2024, 1, 2), date(2024, 1, 2))])
        == []
    )


def test_ongoing_requires_explicit_as_of_and_rejects_entry_after_it():
    stay = OngoingStay("ongoing", date(2024, 2, 1))
    assert codes([stay]) == {IssueCode.AS_OF_REQUIRED}
    assert codes([stay], as_of=D) == {IssueCode.ONGOING_AFTER_AS_OF}
    assert validate_history([stay], as_of=date(2024, 2, 2)) == []
    assert codes([stay], as_of=datetime(2024, 2, 2)) == {IssueCode.INVALID_DATE}


def test_malformed_ongoing_entry_is_not_silently_coerced():
    assert codes([OngoingStay("a", "2024-01-01")], as_of=D) == {IssueCode.INVALID_DATE}


def test_public_calculator_refuses_unknown_record_types():
    with pytest.raises(HistoryValidationError) as error:
        usage_on([{"entry": D, "exit": D, "legal_basis": "unknown"}], D)
    assert error.value.issues[0].code is IssueCode.STAY_TYPE


def test_ongoing_overlap_and_multiple_ongoing_stays_are_rejected():
    assert codes(
        [OngoingStay("a", D), OngoingStay("b", date(2024, 1, 2))], as_of=date(2024, 2, 1)
    ) == {IssueCode.OVERLAPPING_STAYS}
    assert codes([ShortStay("a", D, D), OngoingStay("b", D)], as_of=D) == {
        IssueCode.OVERLAPPING_STAYS,
    }


def test_input_models_are_immutable():
    for stay in (ShortStay("a", D, D), OngoingStay("b", D)):
        with pytest.raises(FrozenInstanceError):
            stay.entry = date(2024, 2, 1)
