"""Patient directory + intake business logic.

Public API responses never include ``password_hash`` and never fabricate data.
"""
from __future__ import annotations

from app.extensions import db
from app.models import PatientProfile, User, UserRole
from app.repositories import patient_repo
from app.schemas import serialize_patient, serialize_user
from app.schemas.case import serialize_case_full
from app.schemas.workflow import serialize_staff_member
from app.utils import (
    ConflictError,
    NotFoundError,
    ValidationError,
    hash_password,
    normalize_sex,
)


def _clean_sex(value) -> str | None:
    """Normalise to the canonical 'M'/'F' using the shared normaliser.

    Delegates to ``normalize_sex`` so a value written here is always readable by
    the intake endpoint (which validates the same canonical set).
    """
    return normalize_sex(value)


def _clean_age(value) -> int | None:
    if value in (None, ""):
        return None
    try:
        age = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError("'age' must be a whole number.", "invalid_age") from exc
    if age < 0 or age > 130:
        raise ValidationError("'age' must be between 0 and 130.", "invalid_age")
    return age


def list_patients() -> list[dict]:
    out = []
    for user, profile in patient_repo.list_patients_with_profiles():
        record = serialize_patient(user, profile)
        record.update(patient_repo.patient_activity_counts(user.id))
        out.append(record)
    return out


def get_patient(patient_id: str) -> User:
    user = db.session.get(User, patient_id)
    if user is None or user.role != UserRole.patient:
        raise NotFoundError("Patient not found.")
    return user


def get_patient_detail(patient_id: str) -> dict:
    user = get_patient(patient_id)
    profile = patient_repo.get_patient_profile(user.id)
    record = serialize_patient(user, profile)
    record.update(patient_repo.patient_activity_counts(user.id))
    cases = sorted(user.cases_as_patient or [], key=lambda c: c.created_at, reverse=True)
    record["cases"] = [
        serialize_case_full(case, arrival_order=idx) for idx, case in enumerate(cases)
    ]
    return record


def create_patient(data: dict) -> User:
    """Staff-registered (walk-in) patient. Passwords are never auto-generated."""
    full_name = (data.get("fullName") or data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip()
    email = (data.get("email") or "").strip() or None
    if not full_name:
        raise ValidationError("'fullName' is required.", "required_field_missing")
    if not phone:
        raise ValidationError("'phone' is required.", "required_field_missing")
    if email and patient_repo.find_patient_by_email(email):
        raise ConflictError("A patient with that email already exists.", "duplicate_patient")
    if patient_repo.find_patient_by_phone(phone):
        raise ConflictError("A patient with that phone number already exists.", "duplicate_patient")

    password = data.get("password") or ""
    user = patient_repo.create_patient_record(
        full_name=full_name,
        phone=phone,
        email=email,
        age=_clean_age(data.get("age")),
        sex=_clean_sex(data.get("sex")),
        language=(data.get("language") or "en"),
        password_hash=hash_password(password) if password else None,
    )
    db.session.commit()
    return user


def update_patient(patient_id: str, data: dict, *, commit: bool = True) -> User:
    user = get_patient(patient_id)
    if data.get("fullName") or data.get("name"):
        user.full_name = (data.get("fullName") or data.get("name")).strip()
    if "phone" in data:
        phone = (data.get("phone") or "").strip() or None
        if phone and phone != user.phone:
            existing = patient_repo.find_patient_by_phone(phone)
            if existing and existing.id != user.id:
                raise ConflictError("That phone number belongs to another patient.", "duplicate_patient")
        user.phone = phone
    if "email" in data:
        email = (data.get("email") or "").strip() or None
        if email and email != user.email:
            existing = patient_repo.find_patient_by_email(email)
            if existing and existing.id != user.id:
                raise ConflictError("That email belongs to another patient.", "duplicate_patient")
        user.email = email
    if data.get("language"):
        user.language = data["language"]

    profile = patient_repo.get_patient_profile(user.id)
    if "age" in data or "sex" in data:
        if profile is None:
            profile = PatientProfile(user_id=user.id)
            db.session.add(profile)
        patient_repo.update_patient_profile(
            profile,
            age=_clean_age(data.get("age")) if "age" in data else None,
            sex=_clean_sex(data.get("sex")) if "sex" in data else None,
        )
    if commit:
        db.session.commit()
    return user


def set_credentials(patient_id: str, password: str, *, actor_id: str | None = None) -> User:
    """Attach a password to a patient record created by the public booking form.

    Staff-only: this is the verified path that turns a booking record into a
    login-capable patient account. Self-service claiming is deliberately not
    offered — without SMS/OTP verification it would be an account-takeover
    vector for clinical records.
    """
    if not password or len(password) < 6:
        raise ValidationError("'password' must be at least 6 characters.", "weak_password")
    user = get_patient(patient_id)
    user.set_password(password)
    db.session.commit()

    from app.repositories import log_audit

    log_audit(
        action="patient.credentials_set",
        user_id=actor_id,
        patient_case_id=None,
        detail={"patientId": patient_id},
    )
    return user


# ---------------------------------------------------------------------------
# Staff directory
# ---------------------------------------------------------------------------


def list_doctors() -> list[dict]:
    return [
        serialize_staff_member(user, getattr(doctor_profile, "specialization", None))
        for user, doctor_profile, _nurse in patient_repo.list_doctors()
    ]


def list_nurses() -> list[dict]:
    return [
        serialize_staff_member(user, getattr(nurse_profile, "badge_id", None))
        for user, _doctor, nurse_profile in patient_repo.list_nurses()
    ]


def list_all_users(role: str | None = None, is_active: bool | None = None) -> list[dict]:
    return [serialize_user(u) for u in patient_repo.list_users_filtered(role, is_active)]