"""Nurse workspace API.

GET  /api/nurses/me/queue                 nurse   — triage queue for this nurse
GET  /api/nurses/me/queue/<case_id>       nurse   — one queue case in full detail
GET  /api/nurses/me/recommendations       nurse   — recommended tests addressed
                                                      to the logged-in nurse
GET  /api/nurses/<nurse_id>/recommendations staff  — same list for an explicit
                                                      nurse id (self/admin/doctor)
PATCH /api/nurses/assignments/<id>/status  staff  — acknowledge / complete tests
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user, jwt_required

from app.api._helpers import int_arg, json_body, role_guard, str_arg
from app.utils import AuthError, ok

bp = Blueprint("nurses", __name__, url_prefix="/api/nurses")


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


@bp.route("/me/queue", methods=["GET"])
@role_guard("nurse")
def my_queue():
    from app.services import case_service

    return ok(case_service.list_queue(current_user, limit=int_arg("limit", minimum=1, maximum=200)))


@bp.route("/me/queue/<case_id>", methods=["GET"])
@role_guard("nurse", "doctor", "admin")
def my_queue_case(case_id: str):
    """The dedicated Nurse "Patient details" payload for one case.

    Composed from the SAME sources as the queue list (the real case, its real
    patient record and its real test assignments) so the detail screen can never
    drift from the queue. Nothing is cached client-side and nothing is invented:
    a field that the backend does not hold is simply omitted.
    """
    from app.services import case_service, recommendation_service

    case = case_service.get_case_or_404(case_id)
    # Staff share the intake queue; require_access still enforces the patient rule.
    case_service.require_access(current_user, case)

    assignments = recommendation_service.list_assignments(
        current_user, case_id=case.id, limit=200
    )["items"]
    return ok(
        case_service.nurse_patient_detail(case, assignments=assignments),
    )


@bp.route("/me/recommendations", methods=["GET"])
@role_guard("nurse")
def my_recommendations():
    from app.services import recommendation_service

    result = recommendation_service.list_assignments(current_user, status=str_arg("status"))
    return ok(result["items"], 200, total=result["total"])


@bp.route("/<nurse_id>/recommendations", methods=["GET"])
@jwt_required()
def nurse_recommendations(nurse_id: str):
    # A nurse may only list their own queue; doctors/admins may view any nurse's.
    role = _role(current_user)
    if role == "nurse" and nurse_id != current_user.id:
        raise AuthError("forbidden_nurse", "You may only view your own recommendations.", 403)
    if role == "patient":
        raise AuthError("forbidden_role", "Patients cannot view nurse recommendations.", 403)

    from app.services import recommendation_service

    result = recommendation_service.list_assignments(
        current_user, nurse_id=nurse_id, status=str_arg("status")
    )
    return ok(result["items"], 200, total=result["total"])


@bp.route("/assignments/<assignment_id>/status", methods=["PATCH"])
@role_guard("nurse", "doctor", "admin")
def set_assignment_status(assignment_id: str):
    from app.services import recommendation_service

    return ok(recommendation_service.update_assignment(assignment_id, json_body(), current_user))

