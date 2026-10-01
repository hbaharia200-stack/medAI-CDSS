"""Authentication service - user registration.

Role auth rules (from the product spec):
  * patient  -> registers with a password (hashed, never plaintext).
  * nurse    -> passwordless (Staff ID is the credential).
  * doctor   -> passwordless (Staff ID is the credential).
  * admin    -> password-based (backend-only; no frontend registration UI).
"""
from __future__ import annotations

from app.extensions import db
from app.models import DoctorProfile, NurseProfile, PatientProfile, User, UserRole
from app.repositories import create_user, get_user_by_email, get_user_by_phone, get_user_by_staff_id
from app.utils import AuthError, ConflictError, hash_password, normalize_sex


def _check_unique_staff_id(staff_id: str | None, user_id: str | None = None) -> None:
    if not staff_id:
        return
    existing = get_user_by_staff_id(staff_id)
    if existing and existing.id != user_id:
        raise ConflictError("That Staff ID is already registered.")


def _check_unique_email(email: str | None, user_id: str | None = None) -> None:
    if not email:
        return
    existing = get_user_by_email(email)
    if existing and existing.id != user_id:
        raise ConflictError("That email is already registered.")


def _check_unique_phone(phone: str | None, user_id: str | None = None) -> None:
    if not phone:
        return
    existing = get_user_by_phone(phone)
    if existing and existing.id != user_id:
        raise ConflictError("That phone number is already registered.")


def register_patient(data: dict) -> User:
    full_name = (data.get("name") or data.get("fullName") or "").strip()
    phone = (data.get("phone") or "").strip()
    password = data.get("password") or ""
    email = (data.get("email") or "").strip() or None
    age = data.get("age")
    # Normalise sex through the shared helper. The previous
    # ``(data.get("sex") or "").upper()`` stored "MALE"/"FEMALE" verbatim into
    # PatientProfile.sex, which the intake endpoint then rejected as invalid —
    # so a value this endpoint had written could not be read back by it.
    sex = normalize_sex(data.get("sex"))
    if age is not None:
        try:
            age = int(str(age).strip())
        except (TypeError, ValueError) as exc:
            raise AuthError("invalid_age", "Age must be a whole number.", 422) from exc
        if not 0 <= age <= 130:
            raise AuthError("invalid_age", "Age must be between 0 and 130.", 422)

    if not full_name:
        raise AuthError("name_required", "Full name is required.", 422)
    if not phone:
        raise AuthError("phone_required", "Phone number is required.", 422)
    if not password:
        raise AuthError("password_required", "Patient password is required.", 422)

    _check_unique_email(email)
    _check_unique_phone(phone)
    user = create_user(
        full_name=full_name, role=UserRole.patient, email=email, phone=phone,
        password_hash=hash_password(password), language=data.get("language", "en"),
    )
    db.session.flush()
    db.session.add(PatientProfile(
        user_id=user.id,
        age=age,
        sex=sex,
    ))
    db.session.commit()
    return user


def register_staff(data: dict, role: UserRole) -> User:
    """Register a nurse or doctor (passwordless: Staff ID is the credential)."""
    full_name = (data.get("fullName") or data.get("name") or "").strip()
    staff_id = (data.get("staffId") or "").strip()
    email = (data.get("email") or "").strip() or None
    phone = (data.get("phone") or "").strip() or None
    specialization = (data.get("specialization") or "").strip() or None
    picture = data.get("picture") or None

    if not full_name:
        raise AuthError("name_required", "Full name is required.", 422)
    if not staff_id:
        raise AuthError("staff_id_required", "Staff ID is required.", 422)

    _check_unique_staff_id(staff_id)
    _check_unique_email(email)
    _check_unique_phone(phone)

    user = create_user(
        full_name=full_name, role=role, email=email, phone=phone, staff_id=staff_id,
        password_hash=None,  # passwordless
    )
    db.session.flush()
    if role == UserRole.doctor:
        db.session.add(DoctorProfile(user_id=user.id, specialization=specialization, picture=picture))
    elif role == UserRole.nurse:
        db.session.add(NurseProfile(user_id=user.id))
    db.session.commit()
    return user


def register_admin(data: dict) -> User:
    full_name = (data.get("fullName") or data.get("name") or "").strip()
    email = (data.get("email") or "").strip() or None
    password = data.get("password") or ""
    if not full_name or not password:
        raise AuthError("admin_requires_name_password", "Admin requires name + password.", 422)
    _check_unique_email(email)
    user = create_user(
        full_name=full_name, role=UserRole.admin, email=email, password_hash=hash_password(password),
    )
    db.session.commit()
    return user


def register(data: dict) -> User:
    """Dispatch registration by role."""
    role = (data.get("role") or "").strip().lower()
    if role == UserRole.patient.value:
        return register_patient(data)
    if role == UserRole.nurse.value:
        return register_staff(data, UserRole.nurse)
    if role == UserRole.doctor.value:
        return register_staff(data, UserRole.doctor)
    if role == UserRole.admin.value:
        return register_admin(data)
    raise AuthError("invalid_role", f"Unknown role '{role}'.", 422)
