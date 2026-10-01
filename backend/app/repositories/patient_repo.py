"""Patient + staff directory queries and profile maintenance.

Kept separate from ``repositories/__init__`` (which holds the auth-critical
user lookups) so the directory logic used by the clinical workflows has a
single, testable home.
"""
from __future__ import annotations

from app.extensions import db
from app.models import (
    Appointment,
    DoctorProfile,
    NurseProfile,
    PatientCase,
    PatientProfile,
    User,
    UserRole,
)


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------


def get_patient_profile(user_id: str) -> PatientProfile | None:
    return db.session.get(PatientProfile, user_id)


def list_patients_with_profiles() -> list[tuple[User, PatientProfile | None]]:
    return (
        db.session.query(User, PatientProfile)
        .outerjoin(PatientProfile, PatientProfile.user_id == User.id)
        .filter(User.role == UserRole.patient)
        .order_by(User.created_at.desc())
        .all()
    )


def find_patient_by_phone(phone: str) -> User | None:
    if not phone:
        return None
    return (
        db.session.query(User)
        .filter(User.role == UserRole.patient, User.phone == phone.strip())
        .first()
    )


def find_patient_by_email(email: str) -> User | None:
    if not email:
        return None
    return (
        db.session.query(User)
        .filter(User.role == UserRole.patient, db.func.lower(User.email) == email.strip().lower())
        .first()
    )


def create_patient_record(
    *,
    full_name: str,
    phone: str,
    email: str | None = None,
    age: int | None = None,
    sex: str | None = None,
    language: str = "en",
    password_hash: str | None = None,
) -> User:
    """Create a patient User + clinical profile.

    ``password_hash`` stays None for patients created from the public booking
    form: those are clinical records, not accounts. Staff can attach
    credentials later via ``POST /api/patients/<id>/credentials``.
    """
    user = User(
        full_name=full_name,
        role=UserRole.patient,
        phone=phone,
        email=email,
        password_hash=password_hash,
        language=language,
    )
    db.session.add(user)
    db.session.flush()
    db.session.add(PatientProfile(user_id=user.id, age=age, sex=sex))
    db.session.flush()
    return user


def update_patient_profile(profile: PatientProfile | None, *, age=None, sex=None) -> None:
    if profile is None:
        return
    if age is not None:
        profile.age = age
    if sex is not None:
        profile.sex = sex
    db.session.add(profile)


# ---------------------------------------------------------------------------
# Staff directory (doctors / nurses)
# ---------------------------------------------------------------------------


def list_staff(role: UserRole) -> list[tuple[User, DoctorProfile | None, NurseProfile | None]]:
    return (
        db.session.query(User, DoctorProfile, NurseProfile)
        .outerjoin(DoctorProfile, DoctorProfile.user_id == User.id)
        .outerjoin(NurseProfile, NurseProfile.user_id == User.id)
        .filter(User.role == role, User.is_active.is_(True))
        .order_by(User.full_name.asc())
        .all()
    )


def list_doctors():
    return list_staff(UserRole.doctor)


def list_nurses():
    return list_staff(UserRole.nurse)


def find_doctor_by_label(label: str) -> User | None:
    """Resolve the public booking form's free-text doctor/specialist label.

    Accepts a Staff ID, a doctor's name, or a specialization (case-insensitive).
    Returns None when nothing matches — the booking is then left unassigned
    (``pending``) for staff to triage, rather than being invented.
    """
    if not label:
        return None
    value = label.strip()
    if not value:
        return None

    by_staff_id = (
        db.session.query(User)
        .filter(User.role == UserRole.doctor, db.func.upper(User.staff_id) == value.upper())
        .first()
    )
    if by_staff_id:
        return by_staff_id

    by_name = (
        db.session.query(User)
        .filter(User.role == UserRole.doctor, User.full_name.ilike(f"%{value}%"))
        .first()
    )
    if by_name:
        return by_name

    return (
        db.session.query(User)
        .join(DoctorProfile, DoctorProfile.user_id == User.id)
        .filter(
            User.role == UserRole.doctor,
            DoctorProfile.specialization.ilike(f"%{value}%"),
        )
        .first()
    )


# ---------------------------------------------------------------------------
# Users (admin management)
# ---------------------------------------------------------------------------


def list_users_filtered(role: str | None = None, is_active: bool | None = None) -> list[User]:
    q = db.session.query(User)
    if role:
        q = q.filter(User.role == UserRole(role))
    if is_active is not None:
        q = q.filter(User.is_active.is_(is_active))
    return q.order_by(User.created_at.desc()).all()


def count_users_by_role() -> dict[str, int]:
    rows = db.session.query(User.role, db.func.count(User.id)).group_by(User.role).all()
    return {(r.value if hasattr(r, "value") else str(r)): int(c) for r, c in rows}


def save(user: User) -> User:
    db.session.add(user)
    db.session.commit()
    return user


def delete(user: User) -> None:
    db.session.delete(user)
    db.session.commit()


def patient_activity_counts(patient_id: str) -> dict:
    """Case / appointment counters shown on the patient detail screens."""
    cases = db.session.query(PatientCase).filter(PatientCase.patient_id == patient_id).count()
    open_cases = (
        db.session.query(PatientCase)
        .filter(PatientCase.patient_id == patient_id, PatientCase.status != "completed")
        .count()
    )
    appointments = db.session.query(Appointment).filter(Appointment.patient_id == patient_id).count()
    return {"cases": cases, "openCases": open_cases, "appointments": appointments}