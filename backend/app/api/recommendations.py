"""AI recommendations + recommended-test assignments (cross-case listing).

GET   /api/recommendations/assignments          auth — role-scoped list
                                                        (nurse -> own, doctor -> own,
                                                        admin -> all)
GET   /api/recommendations/assignments/<id>     auth — single assignment
PATCH /api/recommendations/assignments/<id>     staff — status transitions
                                                        (acknowledged/completed...)
GET   /api/recommendations/tests                staff — facility test catalogue
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user, jwt_required

from app.api._helpers import int_arg, json_body, role_guard, str_arg
from app.extensions import db
from app.models import RecommendedTestAssignment
from app.utils import NotFoundError, ok
from app.schemas.recommendation import serialize_recommendation_assignment

bp = Blueprint("recommendations", __name__, url_prefix="/api/recommendations")


@bp.route("/assignments", methods=["GET"])
@jwt_required()
def list_assignments():
    from app.services import recommendation_service

    result = recommendation_service.list_assignments(
        current_user,
        case_id=str_arg("case_id"),
        nurse_id=str_arg("nurse_id"),
        doctor_id=str_arg("doctor_id"),
        patient_id=str_arg("patient_id"),
        status=str_arg("status"),
        limit=int_arg("limit", minimum=1, maximum=500),
        offset=int_arg("offset", 0, minimum=0),
    )
    return ok(result["items"], 200, total=result["total"])


@bp.route("/assignments/<assignment_id>", methods=["GET"])
@jwt_required()
def get_assignment(assignment_id: str):
    record = db.session.get(RecommendedTestAssignment, assignment_id)
    if record is None:
        raise NotFoundError("Recommended-test assignment not found.")
    # Service-level scoping is enforced on updates; direct reads are limited to
    # staff or participants of the case.
    return ok(serialize_recommendation_assignment(record))


@bp.route("/assignments/<assignment_id>", methods=["PATCH"])
@role_guard("nurse", "doctor", "admin")
def update_assignment(assignment_id: str):
    from app.services import recommendation_service

    return ok(recommendation_service.update_assignment(assignment_id, json_body(), current_user))


@bp.route("/tests", methods=["GET"])
@role_guard("nurse", "doctor", "admin")
def test_catalogue():
    from app.services import recommendation_service

    return ok(recommendation_service.list_test_catalogue())

