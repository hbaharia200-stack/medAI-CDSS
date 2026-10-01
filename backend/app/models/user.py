"""User / auth-related models and role profiles."""
from __future__ import annotations

import enum

from app.extensions import db
from app.utils import gen_uuid, hash_password
from . import UserRole


class TokenBlocklist(db.Model):
    """JWT refresh-token blocklist (for real logout/revocation)."""

    __tablename__ = "token_blocklist"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), unique=True, nullable=False, index=True)
    token_type = db.Column(db.String(10), nullable=False)  # access | refresh
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)


class User(db.Model):
    """Authentication anchor. One row per person; ``role`` scopes access.

    Nurses and doctors are passwordless in this product (login is by Staff ID),
    so ``password_hash`` is NULL for them by design. Only patients set a
    password (hashed with Werkzeug PBKDF2 — never plaintext).
    """

    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=gen_uuid)
    email = db.Column(db.String(255), unique=True, nullable=True, index=True)
    phone = db.Column(db.String(32), nullable=True)
    full_name = db.Column(db.String(255), nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)  # NULL for nurses/doctors
    role = db.Column(db.Enum(UserRole, native_enum=False, length=16), nullable=False, index=True)
    staff_id = db.Column(db.String(64), unique=True, nullable=True, index=True)
    language = db.Column(db.String(8), nullable=False, default="en")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now(), nullable=False)

    # Convenience accessors ------------------------------------------------
    @property
    def is_doctor(self) -> bool:
        return self.role == UserRole.doctor

    @property
    def is_nurse(self) -> bool:
        return self.role == UserRole.nurse

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.admin

    @property
    def is_patient(self) -> bool:
        return self.role == UserRole.patient

    def set_password(self, password: str) -> None:
        self.password_hash = hash_password(password)

    def public_dict(self) -> dict:
        """Non-sensitive projection sent to clients (never password_hash)."""
        return {
            "id": self.id,
            "uuid": self.uuid,
            "full_name": self.full_name,
            "role": self.role.value,
            "email": self.email,
            "phone": self.phone,
            "staff_id": self.staff_id,
            "language": self.language,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PatientProfile(db.Model):
    """Clinical profile attached 1:1 to a patient User."""

    __tablename__ = "patient_profiles"

    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), primary_key=True)
    age = db.Column(db.Integer, nullable=True)
    sex = db.Column(db.String(1), nullable=True)  # 'M' | 'F'

    user = db.relationship("User", backref=db.backref("patient_profile", uselist=False))


class DoctorProfile(db.Model):
    """Doctor-specific profile (specialization, picture, availability)."""

    __tablename__ = "doctor_profiles"

    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), primary_key=True)
    specialization = db.Column(db.String(128), nullable=True)
    picture = db.Column(db.Text, nullable=True)  # data URL or URL
    license_number = db.Column(db.String(64), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    #: Whether the doctor is currently taking work. Persisted (NOT local UI
    #: state) so it survives refresh / logout / login and can back the future
    #: patient-facing "no doctor available -> book an appointment" fallback.
    #: Defaults to available so an existing doctor row is never accidentally
    #: treated as off-duty.
    is_available = db.Column(db.Boolean, nullable=False, default=True, server_default="1")

    user = db.relationship("User", backref=db.backref("doctor_profile", uselist=False))

    @property
    def availability(self) -> str:
        """Stable public enum used by the API and the web Settings toggle."""
        return "available" if self.is_available else "not_available"


class NurseProfile(db.Model):
    """Nurse-specific profile."""

    __tablename__ = "nurse_profiles"

    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), primary_key=True)
    badge_id = db.Column(db.String(64), nullable=True)  # optional staff badge

    user = db.relationship("User", backref=db.backref("nurse_profile", uselist=False))
