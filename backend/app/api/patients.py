"""Patient directory API.

GET    /api/patients                 staff   — list patients (+ activity counts)
POST   /api/patients                 staff   — register a walk-in patient
GET    /api/patients/me              patient — own record
GET    /api/patients/<id>            self/staff — patient detail + cases
PATCH  /api/patients/<id>            self/staff — update contact/demographics
GET    /api/patients/<id>/cases      self/staff — that patient's cases
POST   /api/patients/<id>/credentials staff  — attach login credentials to a
                                               booking-created record
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user, jwt_required

from app.api._helpers import json_body, role_guard
from app.schemas import serialize_patient
from app.services import case_service, patient_service
from app.utils import AuthError, ok

bp = Blueprint("patients", __name__, url_prefix="/api/patients")


@bp.route("", methods=["GET"])
@role_guard("nurse", "doctor", "admin")
def list_patients():
    return ok(patient_service.list_patients())


@bp.route("", methods=["POST"])
@role_guard("nurse", "doctor", "admin")
def create_patient():
    user = patient_service.create_patient(json_body())
    profile = patient_service.patient_repo.get_patient_profile(user.id)
    return ok(serialize_patient(user, profile), 201)


@bp.route("/me", methods=["GET"])
@role_guard("patient")
def me():
    return ok(patient_service.get_patient_detail(current_user.id))


@bp.route("/<patient_id>", methods=["GET"])
@jwt_required()
def get_patient(patient_id: str):
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role == "patient" and patient_id != current_user.id:
        raise AuthError("forbidden_patient", "You may only view your own record.", 403)
    return ok(patient_service.get_patient_detail(patient_id))


@bp.route("/<patient_id>", methods=["PATCH"])
@jwt_required()
def update_patient(patient_id: str):
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role == "patient":
        if patient_id != current_user.id:
            raise AuthError("forbidden_patient", "You may only update your own record.", 403)
        data = json_body()
        allowed = {"phone", "email", "language", "fullName", "name", "age", "sex"}
        data = {k: v for k, v in data.items() if k in allowed}
    else:
        data = json_body()
    user = patient_service.update_patient(patient_id, data)
    profile = patient_service.patient_repo.get_patient_profile(user.id)
    return ok(serialize_patient(user, profile))


@bp.route("/<patient_id>/cases", methods=["GET"])
@jwt_required()
def patient_cases(patient_id: str):
    role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if role == "patient" and patient_id != current_user.id:
        raise AuthError("forbidden_patient", "You may only view your own cases.", 403)
    result = case_service.list_cases(current_user, patient_id=patient_id)
    return ok(result["items"], 200, total=result["total"])


@bp.route("/<patient_id>/credentials", methods=["POST"])
@role_guard("admin", "nurse", "doctor")
def set_credentials(patient_id: str):
    """Attach a password to a record created by the public booking form."""
    data = json_body()
    password = data.get("password") or ""
    user = patient_service.set_credentials(patient_id, password, actor_id=current_user.id)
    profile = patient_service.patient_repo.get_patient_profile(user.id)
    return ok(serialize_patient(user, profile))
