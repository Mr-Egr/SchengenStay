"""Six-status arithmetic compliance contract; standalone usage snapshots omit status."""

from enum import StrEnum


class ResultStatus(StrEnum):
    """Result codes from CALCULATION_RULES.md, section 7.

    WITHIN_RULE describes supported arithmetic only, never permission to travel.
    """

    WITHIN_RULE = "WITHIN_RULE"
    VIOLATION = "VIOLATION"
    INVALID_INPUT = "INVALID_INPUT"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"
    HORIZON_LIMIT = "HORIZON_LIMIT"
