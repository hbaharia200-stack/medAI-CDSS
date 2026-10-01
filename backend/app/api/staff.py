"""Authenticated, minimal staff directory for staff messaging.

GET   /api/staff                doctor|nurse|admin — staff directory
POST  /api/staff                admin — create a staff (doctor/nurse) account
PATCH /api/staff/<id>           admin — edit name/role/specialization/active
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user

from app.api._helpers import json_body, role_guard, str_arg
from app.extensions import db
from app.models import DoctorProfile, NurseProfile, UserRole
from app.repositories import get_user_by_id, get_user_by_staff_id, log_audit, save_user
from app.services import auth_service, patient_service
from app.utils import AuthError, ConflictError, NotFoundError, ValidationError, ok

bp = Blueprint("staff", __name__, url_prefix="/api/staff")


@bp.route("", methods=["GET"])
@role_guard("doctor", "nurse", "admin")
def list_staff():
    role = (str_arg("role") or "doctor").lower()
    if role == "doctor":
        members = patient_service.list_doctors()
    elif role == "nurse":
        members = patient_service.list_nurses()
    else:
        raise ValidationError("'role' must be doctor or nurse.", "invalid_role")
    return ok([
        {
            "id": member["id"],
            "fullName": member["fullName"],
            "role": member["role"],
            "staffId": member["staffId"],
            "specialization": member.get("specialization"),
        }
        for member in members
    ])


# ---------------------------------------------------------------------------------
# Admin user management
#
# These are the *real* writes behind the web admin "User management" screen. They
# were previously simulated in the browser; every call now persists to `users`
# and is written to the audit log.
# ---------------------------------------------------------------------------------


@bp.route("", methods=["POST"])
@role_guard("admin")
def create_staff_account():
    """Create a doctor or nurse account (passwordless, Staff ID is the credential)."""
    data = json_body()
    role = (data.get("role") or "").strip().lower()
    if role not in (UserRole.doctor.value, UserRole.nurse.value):
        raise ValidationError("'role' must be doctor or nurse.", "invalid_role")
    user = auth_service.register_staff(data, UserRole(role))
    log_audit(
        action="user.created",
        user_id=current_user.id,
        role="admin",
        detail={"userId": user.id, "role": role, "staffId": user.staff_id},
    )
    from app.schemas import serialize_user

    return ok(serialize_user(user), 201)


@bp.route("/<user_id>", methods=["PATCH"])
@role_guard("admin")
def update_staff_account(user_id: str):
    """Edit a staff account. Role changes keep the account in the staff domain."""
    user = get_user_by_id(user_id)
    if user is None:
        raise NotFoundError("User not found.")
    if user.role == UserRole.patient:
        raise AuthError(
            "forbidden_target",
            "Use the patient endpoints to edit a patient account.",
            403,
        )

    data = json_body()
    name = (data.get("fullName") or data.get("name") or "").strip()
    if name:
        user.full_name = name

    new_role = (data.get("role") or "").strip().lower()
    if new_role and new_role != user.role.value:
        if new_role not in (UserRole.doctor.value, UserRole.nurse.value):
            raise ValidationError("'role' must be doctor or nurse.", "invalid_role")
        # Profile rows are role-specific, so a role change must migrate them.
        db.session.delete(DoctorProfile.query.filter_by(user_id=user.id).first()
                          or NurseProfile.query.filter_by(user_id=user.id).first())
        db.session.flush()
        user.role = UserRole(new_role)
        if new_role == UserRole.doctor.value:
            db.session.add(DoctorProfile(user_id=user.id))
        else:
            db.session.add(NurseProfile(user_id=user.id))

    if "isActive" in data or "is_active" in data:
        raw = data.get("isActive", data.get("is_active"))
        user.is_active = bool(raw) if isinstance(raw, bool) else str(raw).lower() in {"1", "true", "yes", "on"}

    specialization = (data.get("specialization") or "").strip()
    if specialization and user.role == UserRole.doctor:
        profile = db.session.get(DoctorProfile, user.id)
        if profile is None:
            profile = DoctorProfile(user_id=user.id)
            db.session.add(profile)
        profile.specialization = specialization

    new_staff_id = (data.get("staffId") or "").strip()
    if new_staff_id and new_staff_id != user.staff_id:
        if get_user_by_staff_id(new_staff_id) is not None:
            raise ConflictError("That Staff ID is already registered.")
        user.staff_id = new_staff_id

    save_user(user)
    log_audit(
        action="user.updated",
        user_id=current_user.id,
        role="admin",
        detail={"userId": user.id, "fields": sorted(data.keys())},
    )

    from app.schemas import serialize_user

    return ok(serialize_user(user))