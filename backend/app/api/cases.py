"""Clinical case API — the heart of the patient -> nurse -> doctor workflow.

POST   /api/cases                            create intake (patient self / staff
                                             on behalf of a patient)
GET    /api/cases                            list (role-scoped, filterable)
GET    /api/cases/queue                      open cases as QueueCase[]
GET    /api/cases/<id>                       single case (frontend Case shape)
PATCH  /api/cases/<id>                       status / urgent / assignment
POST   /api/cases/<id>/vitals                nurse records vitals
GET    /api/cases/<id>/vitals                vitals history
POST   /api/cases/<id>/symptoms              add symptoms (staff)
POST   /api/cases/<id>/history               add history entries (staff)
GET    /api/cases/<id>/history               history entries
POST   /api/cases/<id>/ai-recommendation     doctor: run the trained model
                                             (503 when no artifact — never faked)
GET    /api/cases/<id>/recommendations       stored AI recommendations
POST   /api/cases/<id>/diagnosis             doctor: record a diagnosis
GET    /api/cases/<id>/diagnosis             list diagnoses
POST   /api/cases/<id>/confirm-diagnosis     doctor: confirm a suggestion as the
                                             diagnosis (completes the case)
POST   /api/cases/<id>/reject-recommendation doctor: "not this — adjust"
GET    /api/cases/<id>/feedback              feedback history
POST   /api/cases/<id>/feedback              submit feedback (learning loop)
POST   /api/cases/<id>/recommended-tests     doctor: send selected tests to nurse
GET    /api/cases/<id>/assignments           test assignments for the case
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user, jwt_required

from app.api._helpers import bool_arg, int_arg, json_body, role_guard, str_arg
from app.schemas.case import serialize_symptom, serialize_vital
from app.services import case_service, diagnosis_service, recommendation_service
from app.utils import ok

bp = Blueprint("cases", __name__, url_prefix="/api/cases")

STAFF = ("nurse", "doctor", "admin")


@bp.route("", methods=["POST"])
@role_guard("patient", "nurse", "doctor", "admin")
def create_case():
    case = case_service.create_case(json_body(), current_user)
    return ok(case_service.case_payload(case.id), 201)


@bp.route("", methods=["GET"])
@jwt_required()
def list_cases():
    result = case_service.list_cases(
        current_user,
        status=str_arg("status"),
        patient_id=str_arg("patient_id"),
        doctor_id=str_arg("doctor_id"),
        nurse_id=str_arg("nurse_id"),
        urgent=bool_arg("urgent"),
        include_completed=(bool_arg("include_completed") is not False),
        limit=int_arg("limit", minimum=1, maximum=500),
        offset=int_arg("offset", 0, minimum=0),
    )
    return ok(result["items"], 200, total=result["total"])


@bp.route("/queue", methods=["GET"])
@role_guard(*STAFF)
def queue():
    return ok(case_service.list_queue(current_user, limit=int_arg("limit", minimum=1, maximum=200)))


@bp.route("/<case_id>", methods=["GET"])
@jwt_required()
def get_case(case_id: str):
    case = case_service.get_case_or_404(case_id)
    case_service.require_access(current_user, case)
    return ok(case_service.case_payload(case_id))


@bp.route("/<case_id>", methods=["PATCH"])
@role_guard(*STAFF)
def update_case(case_id: str):
    case = case_service.update_case(case_id, json_body(), current_user)
    return ok(case_service.case_payload(case.id))


# ---------------------------------------------------------------------------
# Vitals / symptoms / history
# ---------------------------------------------------------------------------


@bp.route("/<case_id>/vitals", methods=["POST"])
@role_guard("nurse", "doctor", "admin")
def add_vitals(case_id: str):
    return ok(case_service.add_vitals(case_id, json_body(), current_user), 201)


@bp.route("/<case_id>/vitals", methods=["GET"])
@jwt_required()
def list_vitals(case_id: str):
    case = case_service.get_case_or_404(case_id)
    case_service.require_access(current_user, case)
    from app.repositories import case_repo

    return ok([serialize_vital(v) for v in case_repo.list_vitals(case_id)])


@bp.route("/<case_id>/symptoms", methods=["POST"])
@role_guard("nurse", "doctor", "admin")
def add_symptoms(case_id: str):
    data = json_body()
    symptoms = data.get("symptoms") or data.get("items") or data
    return ok(case_service.add_symptoms(case_id, symptoms, current_user), 201)


@bp.route("/<case_id>/symptoms", methods=["GET"])
@jwt_required()
def list_symptoms(case_id: str):
    case = case_service.get_case_or_404(case_id)
    case_service.require_access(current_user, case)
    from app.repositories import case_repo

    return ok([serialize_symptom(s) for s in case_repo.list_symptoms(case_id)])


@bp.route("/<case_id>/history", methods=["POST"])
@role_guard("nurse", "doctor", "admin")
def add_history(case_id: str):
    data = json_body()
    entries = data.get("entries") or data.get("entry") or data.get("history")
    return ok(case_service.add_history(case_id, entries, current_user), 201)


@bp.route("/<case_id>/history", methods=["GET"])
@jwt_required()
def list_history(case_id: str):
    case = case_service.get_case_or_404(case_id)
    case_service.require_access(current_user, case)
    from app.repositories import case_repo

    return ok([h.entry for h in case_repo.list_history(case_id)])


# ---------------------------------------------------------------------------
# AI recommendation (doctor)
# ---------------------------------------------------------------------------


@bp.route("/<case_id>/ai-recommendation", methods=["POST"])
@role_guard("doctor", "admin")
def ai_recommendation(case_id: str):
    return ok(recommendation_service.generate_for_case(case_id, current_user), 201)


@bp.route("/<case_id>/ai-recommendation", methods=["GET"])
@jwt_required()
def get_ai_recommendation(case_id: str):
    """Stored recommendations for the case (same contract as /recommendations)."""
    return ok(recommendation_service.list_recommendations(case_id, current_user))


@bp.route("/<case_id>/recommendations", methods=["GET"])
@jwt_required()
def list_recommendations(case_id: str):
    return ok(recommendation_service.list_recommendations(case_id, current_user))


# ---------------------------------------------------------------------------
# Diagnosis (doctor) — the AI suggestion never becomes the diagnosis by itself
# ---------------------------------------------------------------------------


@bp.route("/<case_id>/diagnosis", methods=["POST"])
@role_guard("doctor", "admin")
def create_diagnosis(case_id: str):
    return ok(diagnosis_service.create_diagnosis(case_id, json_body(), current_user), 201)


@bp.route("/<case_id>/diagnosis", methods=["GET"])
@jwt_required()
def list_diagnoses(case_id: str):
    return ok(diagnosis_service.list_diagnoses(case_id, current_user))


@bp.route("/<case_id>/confirm-diagnosis", methods=["POST"])
@role_guard("doctor", "admin")
def confirm_diagnosis(case_id: str):
    return ok(diagnosis_service.confirm_recommendation(case_id, json_body(), current_user), 201)


@bp.route("/<case_id>/reject-recommendation", methods=["POST"])
@role_guard("doctor", "admin")
def reject_recommendation(case_id: str):
    return ok(diagnosis_service.reject_recommendation(case_id, json_body(), current_user))


@bp.route("/<case_id>/feedback", methods=["POST"])
@role_guard("doctor", "admin")
def submit_feedback(case_id: str):
    return ok(recommendation_service.submit_feedback(case_id, json_body(), current_user), 201)


@bp.route("/<case_id>/feedback", methods=["GET"])
@jwt_required()
def list_feedback(case_id: str):
    return ok(diagnosis_service.list_feedback(case_id, current_user))


# ---------------------------------------------------------------------------
# Recommended tests (doctor -> nurse)
# ---------------------------------------------------------------------------


@bp.route("/<case_id>/recommended-tests", methods=["POST"])
@role_guard("doctor", "admin")
def assign_tests(case_id: str):
    return ok(recommendation_service.assign_tests(case_id, json_body(), current_user), 201)


@bp.route("/<case_id>/assignments", methods=["GET"])
@jwt_required()
def list_assignments(case_id: str):
    result = recommendation_service.list_assignments(current_user, case_id=case_id)
    return ok(result["items"], 200, total=result["total"])
