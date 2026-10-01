"""Doctor availability status (Settings -> Available | Not Available).

The status is persisted on ``DoctorProfile`` so it survives a refresh, a logout
and a fresh login. It is deliberately NOT a client-side toggle: the future
patient-side "no doctor available -> book an appointment" fallback has to be
able to read a single trustworthy source of truth.

This service intentionally does NOT implement any automatic scheduling. It only
records whether the doctor is taking work; slot calculation stays a product
decision.
"""
from __future__ import annotations

from app.extensions import db
from app.models import DoctorProfile, User, UserRole
from app.repositories import log_audit
from app.utils import AuthError, NotFoundError, ValidationError

#: Public values accepted by the API. The web toggle posts one of these.
AVAILABLE = "available"
NOT_AVAILABLE = "not_available"
AVAILABILITY_VALUES = {AVAILABLE, NOT_AVAILABLE}

_TRUE = {"available", "true", "1", "yes", "on"}
_FALSE = {"not_available", "not available", "unavailable", "false", "0", "no", "off"}


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


def parse_availability(value) -> bool:
    """Map a client value onto the stored boolean.

    Raises ``ValidationError`` for anything unrecognised so a typo can never be
    silently stored as "available" (which would wrongly advertise a doctor who
    is off duty).
    """
    if isinstance(value, bool):
        return value
    if value is None:
        raise ValidationError("'availability' is required.", "required_field_missing")
    key = str(value).strip().lower()
    if key in _TRUE:
        return True
    if key in _FALSE:
        return False
    raise ValidationError(
        f"'availability' must be one of: {', '.join(sorted(AVAILABILITY_VALUES))}.",
        "invalid_availability",
    )


def get_profile(user_id: str) -> DoctorProfile:
    """The doctor's profile row, created on demand defaulting to available."""
    profile = db.session.get(DoctorProfile, user_id)
    if profile is None:
        profile = DoctorProfile(user_id=user_id, is_available=True)
        db.session.add(profile)
        db.session.flush()
    return profile


def status_payload(user_id: str) -> dict:
    profile = get_profile(user_id)
    return {
        "availability": profile.availability,
        "isAvailable": bool(profile.is_available),
    }


def get_my_availability(actor) -> dict:
    """Read the signed-in doctor's persisted availability."""
    return status_payload(actor.id)


def set_availability(actor, value) -> dict:
    """Persist the signed-in doctor's availability. Doctors only."""
    if _role(actor) != UserRole.doctor.value:
        raise AuthError("forbidden_role", "Only a doctor can set their availability.", 403)

    is_available = parse_availability(value)
    profile = get_profile(actor.id)
    profile.is_available = is_available
    db.session.commit()

    log_audit(
        action="doctor.availability_set",
        user_id=actor.id,
        role=UserRole.doctor.value,
        detail={"availability": profile.availability},
    )
    return status_payload(actor.id)


def set_for_doctor(actor, doctor_id: str, value) -> dict:
    """Admin-side write, used by the staff directory."""
    if _role(actor) != UserRole.admin.value:
        raise AuthError("forbidden_role", "Only an administrator can do this.", 403)
    doctor = db.session.get(User, doctor_id)
    if doctor is None or doctor.role != UserRole.doctor:
        raise NotFoundError("Doctor not found.")
    is_available = parse_availability(value)
    profile = get_profile(doctor.id)
    profile.is_available = is_available
    db.session.commit()
    log_audit(
        action="doctor.availability_set",
        user_id=actor.id,
        role=UserRole.admin.value,
        detail={"doctorId": doctor.id, "availability": profile.availability},
    )
    return status_payload(doctor.id)