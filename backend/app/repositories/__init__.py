"""Data-access repositories.

Thin query layer beneath the services so business logic stays testable and
decoupled from SQLAlchemy details.
"""
from __future__ import annotations

from app.extensions import db
from app.models import User, UserRole


# ---------------------------------------------------------------------------
# Users / auth
# ---------------------------------------------------------------------------


def get_user_by_id(user_id: str) -> User | None:
    return db.session.get(User, user_id)


def get_user_by_email(email: str) -> User | None:
    if not email:
        return None
    return db.session.query(User).filter_by(email=email).first()


def get_user_by_phone(phone: str) -> User | None:
    if not phone:
        return None
    return db.session.query(User).filter_by(phone=phone).first()


def get_user_by_staff_id(staff_id: str) -> User | None:
    """Look up a staff account by Staff ID.

    Staff IDs are stored in the facility's canonical form (``DR001``) but people
    type them as they read them from a badge, so the match is case-insensitive
    and whitespace-trimmed. This also makes the uniqueness check below reject a
    second account that differs only by letter case.
    """
    if not staff_id:
        return None
    ident = str(staff_id).strip()
    if not ident:
        return None
    return (
        db.session.query(User)
        .filter(db.func.lower(User.staff_id) == ident.lower())
        .first()
    )


def get_user_by_identifier(identifier: str) -> User | None:
    """Look up a patient by email, phone, or full name (case-insensitive)."""
    if not identifier:
        return None
    ident = identifier.strip()
    user = get_user_by_email(ident) or get_user_by_phone(ident)
    if user:
        return user
    return (
        db.session.query(User)
        .filter(User.full_name.ilike(ident))
        .filter(User.role == UserRole.patient)
        .first()
    )


def get_patient_user(patient_id: str) -> User | None:
    return get_user_by_id(patient_id)


def list_patients() -> list[User]:
    return (
        db.session.query(User)
        .filter(User.role == UserRole.patient)
        .order_by(User.created_at.desc())
        .all()
    )


def create_user(
    *,
    full_name: str,
    role: UserRole,
    email: str | None = None,
    phone: str | None = None,
    staff_id: str | None = None,
    password_hash: str | None = None,
    language: str = "en",
    is_active: bool = True,
) -> User:
    user = User(
        full_name=full_name,
        role=role,
        email=email,
        phone=phone,
        staff_id=staff_id,
        password_hash=password_hash,
        language=language,
        is_active=is_active,
    )
    db.session.add(user)
    db.session.flush()
    return user


def save_user(user: User) -> User:
    db.session.add(user)
    db.session.commit()
    return user


def list_users() -> list[User]:
    return db.session.query(User).order_by(User.created_at.desc()).all()


# ---------------------------------------------------------------------------
# Re-exports from the specialised repository modules.
#
# Services import these from the package (`from app.repositories import
# log_audit, save_feedback`) so the persistence layer stays a single entry
# point. The modules themselves remain importable directly as well.
# ---------------------------------------------------------------------------
from .audit_repo import list_audit_logs, log_audit, save_feedback  # noqa: E402

__all__ = [
    "get_user_by_id",
    "get_user_by_email",
    "get_user_by_phone",
    "get_user_by_staff_id",
    "get_user_by_identifier",
    "get_patient_user",
    "list_patients",
    "create_user",
    "save_user",
    "list_users",
    "log_audit",
    "list_audit_logs",
    "save_feedback",
]
