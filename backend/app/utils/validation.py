"""Request validation, clinical-range validation, and error types."""
from __future__ import annotations

import datetime
import re
from typing import Any

from flask import request

# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class ValidationError(Exception):
    """Raised when request input fails validation. Carries a machine code."""

    def __init__(self, message: str, code: str = "validation_error", status: int = 422):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status

    def to_dict(self) -> dict:
        return {"error": self.code, "message": self.message}


# ---------------------------------------------------------------------------
# Request validation helpers
# ---------------------------------------------------------------------------


def require_json_fields(*fields: str) -> dict[str, Any]:
    """Validate that a JSON body is present and contains the required fields.

    Returns the parsed body dict. Raises ``ValidationError`` on failure; the
    app factory turns ValidationError into a JSON response.
    """
    data = request.get_json(silent=True)
    if data is None:
        raise ValidationError("Request body must be valid JSON.", "invalid_json")
    missing = [f for f in fields if data.get(f) in (None, "")]
    if missing:
        raise ValidationError(
            f"Missing required field(s): {', '.join(missing)}",
            "required_field_missing",
        )
    return data


# ---------------------------------------------------------------------------
# Clinical value validation
# ---------------------------------------------------------------------------

# Reference ranges — the UI notes these are facility-owned values a teammate
# should own. The backend enforces sane hard bounds and refuses malformed data.
VITAL_RANGES = {
    "temperatureC": (30.0, 43.0),
    "bloodPressureSystolic": (60.0, 250.0),
    "bloodPressureDiastolic": (30.0, 160.0),
    "heartRate": (30.0, 250.0),
    "respiratoryRate": (6.0, 60.0),
    "oxygenSaturation": (50.0, 100.0),
    "bloodGlucoseMgDl": (20.0, 1000.0),
    "weightKg": (1.0, 400.0),
}


def _num(value: Any) -> float | None:
    """Coerce to a finite float, or None if not a usable number."""
    if value is None or value == "":
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n != n or n in (float("inf"), float("-inf")):  # NaN / inf
        return None
    return n


def validate_vitals(vitals: dict) -> dict:
    """Validate a vitals payload; returns a cleaned numeric dict.

    Raises ``ValidationError`` if any value is out of range or malformed.
    """
    cleaned: dict[str, float | None] = {}
    for key, (lo, hi) in VITAL_RANGES.items():
        raw = vitals.get(key)
        if raw is None or raw == "":
            continue
        n = _num(raw)
        if n is None:
            raise ValidationError(f"'{key}' is not a valid number.", "invalid_vital")
        if n < lo or n > hi:
            raise ValidationError(
                f"'{key}' value {n} is outside the acceptable range ({lo}-{hi}).",
                "vital_out_of_range",
            )
        cleaned[key] = n
    if not any(v is not None for v in cleaned.values()):
        raise ValidationError("At least one vital sign must be provided.", "missing_vitals")
    return cleaned


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def is_valid_email(value: str | None) -> bool:
    return bool(value) and bool(_EMAIL_RE.match(value.strip()))


# ---------------------------------------------------------------------------
# Sex normalisation
# ---------------------------------------------------------------------------

#: Canonical stored values. ``PatientProfile.sex`` is a String(1) column and
#: ``_intake_demographics`` validates against exactly these two values.
SEX_VALUES = frozenset({"M", "F"})

#: Spellings a client may legitimately send. The mobile segmented control uses
#: "M"/"F", but a UI that renders a label ("Male"/"Female"), a voice/typed
#: value, or a re-submitted profile that was stored before normalisation all
#: reach this function. Accepting the obvious synonyms is what stops a
#: round-trip of our own data from being rejected as invalid.
_SEX_ALIASES = {
    "M": "M", "MALE": "M", "MALE ": "M",
    "F": "F", "FEMALE": "F",
}


def normalize_sex(value: Any) -> str | None:
    """Map a user-supplied sex onto the canonical ``"M"``/``"F"`` (or None).

    Returns ``None`` for an absent/blank value. Raises ``ValidationError`` for
    anything that is present but not a recognised sex, so genuinely wrong input
    is still reported rather than silently coerced to a guess.

    This is the single normaliser used by registration, the intake payload and
    patient updates, which is what keeps a value written by one endpoint
    readable by the next (the round-trip bug this fixes).
    """
    if value is None:
        return None
    if isinstance(value, bool):  # guard: bool is an int subclass
        raise ValidationError("'sex' must be 'M' or 'F'.", "invalid_sex")
    if isinstance(value, (int, float)):
        raise ValidationError("'sex' must be 'M' or 'F'.", "invalid_sex")
    if not isinstance(value, str):
        raise ValidationError("'sex' must be 'M' or 'F'.", "invalid_sex")
    key = value.strip().upper()
    if not key:
        return None
    # "MALE " with inner spacing, and any casing, collapse onto the same key.
    key = " ".join(key.split())
    resolved = _SEX_ALIASES.get(key)
    if resolved is None:
        raise ValidationError("'sex' must be 'M' or 'F'.", "invalid_sex")
    return resolved


def coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


# ---------------------------------------------------------------------------
# Date / time parsing (appointment booking uses ISO date + HH:MM strings)
# ---------------------------------------------------------------------------

_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y")
_TIME_FORMATS = ("%H:%M", "%H:%M:%S", "%I:%M %p", "%I%p")


def parse_date(value: Any, field: str = "date") -> datetime.date:
    """Parse ``YYYY-MM-DD`` (plus a few common variants) into a ``date``.

    Raises ``ValidationError`` with a stable machine code on bad input.
    """
    if isinstance(value, datetime.datetime):
        return value.date()
    if isinstance(value, datetime.date):
        return value
    if isinstance(value, str) and value.strip():
        raw = value.strip()
        # Tolerate a full ISO timestamp (e.g. 2026-09-20T09:30:00Z).
        try:
            return datetime.datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
        except ValueError:
            pass
        for fmt in _DATE_FORMATS:
            try:
                return datetime.datetime.strptime(raw, fmt).date()
            except ValueError:
                continue
    raise ValidationError(
        f"'{field}' must be a valid date in YYYY-MM-DD format.", "invalid_date"
    )


def parse_time(value: Any, field: str = "time") -> datetime.time:
    """Parse ``HH:MM`` (plus a few common variants) into a ``time``."""
    time_cls = datetime.time
    if isinstance(value, datetime.datetime):
        return value.time().replace(microsecond=0)
    if isinstance(value, time_cls):
        return value
    if isinstance(value, str) and value.strip():
        raw = value.strip()
        if "T" in raw:  # ISO timestamp -> take the time part
            try:
                return datetime.datetime.fromisoformat(raw.replace("Z", "+00:00")).time().replace(microsecond=0)
            except ValueError:
                pass
        for fmt in _TIME_FORMATS:
            try:
                return datetime.datetime.strptime(raw, fmt).time()
            except ValueError:
                continue
    raise ValidationError(
        f"'{field}' must be a valid time in HH:MM format.", "invalid_time"
    )
