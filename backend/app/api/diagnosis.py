"""Diagnosis API (case-scoped endpoints live in the cases blueprint).

GET   /api/diagnosis?case_id=...   staff  — list diagnoses (case_id required or all
                                           for staff dashboards)
GET   /api/diagnosis/<id>          auth   — single diagnosis (patient may read own)
PATCH /api/diagnosis/<id>          doctor — amend notes/severity/confirmation
POST  /api/diagnosis/<id>/confirm  doctor — confirm this diagnosis (completes case)
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user, jwt_required

from app.api._helpers import json_body, role_guard, str_arg
from app.extensions import db
from app.models import Diagnosis
from app.utils import AuthError, NotFoundError, ok

bp = Blueprint("diagnosis", __name__, url_prefix="/api/diagnosis")


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


@bp.route("", methods=["GET"])
@role_guard("nurse", "doctor", "admin")
def list_diagnoses():
    case_id = str_arg("case_id")
    if case_id:
        from app.services import diagnosis_service

        return ok(diagnosis_service.list_diagnoses(case_id, current_user))

    from app.services import diagnosis_service as ds

    # Facility-wide list for dashboards; the service scopes per-role.
    return ok(ds.list_diagnoses_facility(current_user))


@bp.route("/<diagnosis_id>", methods=["GET"])
@jwt_required()
def get_diagnosis(diagnosis_id: str):
    record = db.session.get(Diagnosis, diagnosis_id)
    if record is None:
        raise NotFoundError("Diagnosis not found.")
    if _role(current_user) == "patient" and record.case.patient_id != current_user.id:
        raise AuthError("forbidden_case", "You do not have access to this diagnosis.", 403)
    return ok(record.to_dict())


@bp.route("/<diagnosis_id>", methods=["PATCH"])
@role_guard("doctor", "admin")
def update_diagnosis(diagnosis_id: str):
    from app.services import diagnosis_service

    return ok(diagnosis_service.update_diagnosis(diagnosis_id, json_body(), current_user))


@bp.route("/<diagnosis_id>/confirm", methods=["POST"])
@role_guard("doctor", "admin")
def confirm_diagnosis(diagnosis_id: str):
    from app.services import diagnosis_service

    return ok(diagnosis_service.confirm_diagnosis(diagnosis_id, current_user))

