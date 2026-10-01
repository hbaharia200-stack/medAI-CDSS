"""Serialization helpers — produce the exact public JSON shapes the frontend
(relies/TypeScript types) expects. Kept as pure functions so they are trivially
unit-testable and reusable across routes and services.
"""
from __future__ import annotations

from typing import Any


def _dt(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def serialize_user(user) -> dict:
    """Public, non-sensitive user projection."""
    doctor_profile = getattr(user, "doctor_profile", None)
    nurse_profile = getattr(user, "nurse_profile", None)
    patient_profile = getattr(user, "patient_profile", None)
    return {
        "id": user.id,
        "uuid": user.uuid,
        "full_name": user.full_name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "email": user.email,
        "phone": user.phone,
        "staff_id": user.staff_id,
        "language": user.language,
        "is_active": user.is_active,
        "created_at": _dt(user.created_at),
        # Profile extras (present only for the matching role). Kept flat so the
        # existing web/mobile clients can map them onto DoctorUser directly.
        "specialization": getattr(doctor_profile, "specialization", None),
        "picture": getattr(doctor_profile, "picture", None),
        "bio": getattr(doctor_profile, "bio", None),
        "license_number": getattr(doctor_profile, "license_number", None),
        "badge_id": getattr(nurse_profile, "badge_id", None),
        "age": getattr(patient_profile, "age", None),
        "sex": getattr(patient_profile, "sex", None),
    }


def serialize_patient(user, profile) -> dict:
    base = serialize_user(user)
    base.update({
        "age": profile.age if profile else None,
        "sex": profile.sex if profile else None,
    })
    return base


def serialize_jwt_payload(user) -> dict:
    """Minimal user object included inside auth token response."""
    return {
        "id": user.id,
        "full_name": user.full_name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "staff_id": user.staff_id,
        "email": user.email,
        "phone": user.phone,
    }
