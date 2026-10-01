"""AI recommendation + recommended-test workflow.

Doctor -> (AI suggestion) -> diagnosis -> selected tests -> nurse.

The AI output is clinical *decision support*: it is persisted with its
provenance (model version + raw output) and it NEVER becomes a diagnosis
automatically — the doctor confirms that separately (see diagnosis_service).
"""
from __future__ import annotations

from datetime import datetime

from app.extensions import db
from app.models import CaseStatus, UserRole
from app.repositories import case_repo, log_audit, recommendation_repo, save_feedback
from app.schemas.case import serialize_case_full
from app.schemas.recommendation import serialize_recommendation_assignment
from app.services import ai_service
from app.utils import AuthError, NotFoundError, ValidationError

ASSIGNMENT_STATUSES = {"pending", "sent", "acknowledged", "completed"}
NURSE_STATUSES = {"acknowledged", "completed"}
FEEDBACK_VALUES = {"accurate", "partially_accurate", "not_accurate"}


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


def require_doctor(actor) -> None:
    if _role(actor) not in (UserRole.doctor.value, UserRole.admin.value):
        raise AuthError("forbidden_role", "Only a doctor may perform this action.", 403)


def get_case_or_404(case_id: str):
    case = case_repo.get_case(case_id)
    if case is None:
        raise NotFoundError("Clinical case not found.")
    return case


# ---------------------------------------------------------------------------
# AI recommendation
# ---------------------------------------------------------------------------


def generate_for_case(case_id: str, actor) -> list[dict]:
    """Produce and persist decision support for a case.

    Two sources, tried in order:

    1. The trained clinical artifact (``AI_MODEL_PATH``) — the real thing,
       supplied by the modelling teammate. Preferred whenever it is configured.
    2. The configured AI *provider* producing structured decision support,
       validated server-side by :mod:`app.services.ai.decision_support`.

    Source 2 exists only so the doctor workflow can be exercised before the
    teammate's clinical model lands. It is clearly separated from the
    patient-facing agent (``agent_service``) and can be removed by switching the
    provider without touching any client.

    Raises:
        AIModelNotConfigured: no artifact AND no usable provider -> HTTP 503,
            never a fabricated prediction.
        AIDecisionSupportError: the provider failed or returned something
            unsafe -> HTTP 503, nothing is stored.
    """
    require_doctor(actor)
    case = get_case_or_404(case_id)

    # The serialized case is the feature source (patient / symptoms / vitals /
    # history). ai_service maps it onto the model's own declared feature names.
    case_payload = serialize_case_full(case)

    if ai_service.is_configured():
        predictions = ai_service.predict(case_payload)
    elif _decision_support_mode() == "model_only":
        # Strict behaviour preserved: without the trained artifact there is no
        # clinical model, so we answer 503 rather than substituting anything.
        predictions = ai_service.predict(case_payload)  # raises AIModelNotConfigured
    else:
        predictions = _predict_via_provider(case_payload)

    saved_rows = []
    for prediction in predictions:
        saved_rows.append(
            recommendation_repo.save_recommendation(
                case_id=case.id,
                disease_name=prediction["diseaseName"],
                confidence=prediction["confidence"],
                confidence_score=prediction.get("confidenceScore"),
                top_symptoms_summary=prediction.get("topSymptomsSummary"),
                reasoning_factors=prediction.get("reasoningFactors") or [],
                recommended_tests=prediction.get("recommendedTests") or [],
                raw_output=prediction.get("_raw"),
                model_version=prediction.get("_model_version"),
            )
        )

    if case.status in (CaseStatus.awaiting_review, CaseStatus.vitals_pending, CaseStatus.submitted):
        case.status = CaseStatus.ai_assessed

    db.session.commit()

    log_audit(
        action="ai.recommendation_generated",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=case.id,
        # Provenance of what actually produced these rows. Each prediction
        # already carries its own "_model_version"; the artifact identity is
        # only safe to read when an artifact really produced them.
        detail={
            "count": len(saved_rows),
            "model": saved_rows[0].model_version if saved_rows else None,
        },
    )
    return [
        {**{k: v for k, v in prediction.items() if not k.startswith("_")}, "id": row.id}
        for prediction, row in zip(predictions, saved_rows)
    ]


def _decision_support_mode() -> str:
    """``auto`` | ``model_only`` | ``provider`` (see Config.AI_DECISION_SUPPORT)."""
    try:
        from flask import current_app

        return (current_app.config.get("AI_DECISION_SUPPORT", "auto") or "auto").strip().lower()
    except RuntimeError:
        return "auto"


def _predict_via_provider(case_payload: dict) -> list[dict]:
    """Structured doctor decision support from the configured AI provider.

    Only reached when the trained artifact is absent. The output is converted
    into the SAME ``AIRecommendation`` contract the artifact path produces, so
    the doctor UI and the persistence layer are identical either way.
    """
    from app.services import ai as ai_layer
    from app.services.ai.decision_support import (
        DECISION_SUPPORT_DISCLAIMER,
        DECISION_SUPPORT_LABEL,
        AIDecisionSupportError,
        generate_decision_support,
    )

    provider = ai_layer.get_provider()
    try:
        support = generate_decision_support(provider, case_payload)
    except AIDecisionSupportError as exc:
        # Fail closed with an accurate reason. Nothing is stored.
        from app.ai import AIModelNotConfigured

        raise AIModelNotConfigured(exc.message) from exc

    high_t, med_t = ai_service.confidence_thresholds()

    def _level(percent: int) -> str:
        score = percent / 100.0
        if score >= high_t:
            return "High"
        if score >= med_t:
            return "Medium"
        return "Low"

    out: list[dict] = []
    for condition in support["conditions"]:
        # Rationale is server-truncated text; the disclaimer/label are ours.
        reasoning = [c for c in [condition["rationale"], DECISION_SUPPORT_DISCLAIMER] if c]
        out.append({
            "diseaseName": condition["name"],
            "confidence": _level(condition["confidencePercent"]),
            "confidenceScore": round(condition["confidencePercent"] / 100.0, 4),
            "topSymptomsSummary": DECISION_SUPPORT_LABEL,
            "reasoningFactors": reasoning,
            "recommendedTests": support["suggestedTests"],
            "_raw": {"source": "ai_provider", "disclaimer": DECISION_SUPPORT_DISCLAIMER},
            "_model_version": f"{support['provider']}:{support.get('model') or 'unknown'}",
        })
    return out


def list_recommendations(case_id: str, actor) -> list[dict]:
    # Initial patient visibility never grants access to doctor-only AI
    # reasoning. Nurses receive only the tests a doctor explicitly sends.
    require_doctor(actor)
    get_case_or_404(case_id)
    records = recommendation_repo.list_recommendations_for_case(case_id)
    return [
        {
            "id": r.id,
            "diseaseName": r.disease_name,
            "confidence": r.confidence,
            "confidenceScore": r.confidence_score,
            "topSymptomsSummary": r.top_symptoms_summary,
            "reasoningFactors": r.reasoning_factors or [],
            "recommendedTests": r.recommended_tests or [],
            "modelVersion": r.model_version,
            "createdAt": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


# ---------------------------------------------------------------------------
# Recommended tests: doctor selects -> assignment for the nurse
# ---------------------------------------------------------------------------


def _normalise_tests(raw) -> list[dict]:
    if not raw:
        raise ValidationError("'tests' must contain at least one test.", "required_field_missing")
    if not isinstance(raw, list):
        raise ValidationError("'tests' must be a list.", "invalid_tests")
    tests: list[dict] = []
    for idx, item in enumerate(raw):
        if isinstance(item, str):
            name, test_id = item.strip(), f"test-{idx}"
        elif isinstance(item, dict):
            name = str(item.get("name") or "").strip()
            test_id = str(item.get("id") or f"test-{idx}")
        else:
            raise ValidationError("Each test must be a string or an object with a 'name'.", "invalid_tests")
        if not name:
            raise ValidationError("Each test needs a 'name'.", "invalid_tests")
        test_type = item.get("type", "lab") if isinstance(item, dict) else "lab"
        if test_type not in {"lab", "vital"}:
            raise ValidationError("Test type must be 'lab' or 'vital'.", "invalid_tests")
        tests.append({"id": test_id, "name": name, "type": test_type})
    return tests


def assign_tests(case_id: str, data: dict, actor) -> dict:
    """Create a RecommendedTestAssignment and dispatch it to the nurse queue."""
    require_doctor(actor)
    case = get_case_or_404(case_id)
    tests = _normalise_tests(data.get("tests"))
    nurse_id = (data.get("nurseId") or case.nurse_id) or None
    recommendation_id = data.get("recommendationId") or None

    assignment = recommendation_repo.assign_tests_to_nurse(
        case_id=case.id,
        patient_id=case.patient_id,
        doctor_id=actor.id,
        tests=tests,
        recommendation_id=recommendation_id,
        nurse_id=nurse_id,
    )
    assignment.status = "sent" if nurse_id else "pending"
    if nurse_id:
        assignment.sent_at = datetime.utcnow()
    if case.status in (CaseStatus.submitted, CaseStatus.ai_assessed, CaseStatus.doctor_reviewing, CaseStatus.in_review):
        case.status = CaseStatus.sent_to_nurse
    db.session.commit()

    log_audit(
        action="tests.assigned",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=case.id,
        detail={"tests": [t["name"] for t in tests], "nurseId": nurse_id, "status": assignment.status},
    )
    return serialize_recommendation_assignment(assignment)


def list_assignments(
    actor,
    *,
    case_id: str | None = None,
    nurse_id: str | None = None,
    doctor_id: str | None = None,
    patient_id: str | None = None,
    status: str | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> dict:
    """Nurses/doctors are scoped to their own work; admins see everything."""
    role = _role(actor)
    include_unassigned = False
    if role == UserRole.nurse.value:
        # A nurse opening their own inbox (no explicit nurse_id) also sees
        # doctor-approved tests that are not addressed to a named nurse yet, so
        # "Send to Nurse" always reaches the nursing pool. An explicit
        # /nurses/<id>/recommendations lookup stays exact for doctors/admins.
        include_unassigned = nurse_id is None
        nurse_id = actor.id
    elif role == UserRole.doctor.value:
        doctor_id = actor.id
    elif role == UserRole.patient.value:
        patient_id = actor.id

    rows, total = recommendation_repo.list_assignments_filtered(
        nurse_id=nurse_id,
        doctor_id=doctor_id,
        patient_id=patient_id,
        case_id=case_id,
        status=status,
        include_unassigned=include_unassigned,
        limit=limit,
        offset=offset,
    )
    return {"items": [serialize_recommendation_assignment(a) for a in rows], "total": total}


def update_assignment(assignment_id: str, data: dict, actor) -> dict:
    assignment = recommendation_repo.get_assignment(assignment_id)
    if assignment is None:
        raise NotFoundError("Recommended-test assignment not found.")

    status = str(data.get("status") or "").strip()
    if status not in ASSIGNMENT_STATUSES:
        raise ValidationError(
            f"'status' must be one of: {', '.join(sorted(ASSIGNMENT_STATUSES))}.", "invalid_status"
        )

    role = _role(actor)
    if role == UserRole.nurse.value:
        # An assignment the doctor sent to the nursing pool (no named nurse) is
        # visible in every nurse's inbox — see `list_assignments`. The first
        # nurse to act on it therefore claims it. Without this, a doctor using
        # "Send to Nurse" without picking a colleague created work that the nurse
        # could see but was refused (403) when trying to carry it out.
        if assignment.nurse_id != actor.id:
            if assignment.nurse_id is not None:
                raise AuthError("forbidden_assignment", "This assignment is not addressed to you.", 403)
            assignment.nurse_id = actor.id
        if status not in NURSE_STATUSES:
            raise AuthError(
                "forbidden_status",
                f"A nurse may only set: {', '.join(sorted(NURSE_STATUSES))}.",
                403,
            )
    elif role == UserRole.doctor.value and assignment.doctor_id != actor.id:
        raise AuthError("forbidden_assignment", "This assignment was raised by another doctor.", 403)
    elif role == UserRole.patient.value:
        raise AuthError("forbidden_role", "Patients cannot update test assignments.", 403)

    recommendation_repo.update_assignment_status(assignment, status)
    log_audit(
        action="tests.assignment_updated",
        user_id=actor.id,
        role=role,
        patient_case_id=assignment.case_id,
        detail={"status": status},
    )
    return serialize_recommendation_assignment(assignment)


# ---------------------------------------------------------------------------
# Doctor feedback (learning loop) + test catalogue
# ---------------------------------------------------------------------------


def submit_feedback(case_id: str, data: dict, actor) -> dict:
    """Doctor feedback on an AI suggestion — the learning-loop signal."""
    require_doctor(actor)
    case = get_case_or_404(case_id)

    decision = str(data.get("decision") or "confirmed").strip()
    if decision not in {"confirmed", "adjusted"}:
        raise ValidationError("'decision' must be 'confirmed' or 'adjusted'.", "invalid_decision")

    feedback = data.get("feedback")
    if feedback is not None and feedback not in FEEDBACK_VALUES:
        raise ValidationError(
            f"'feedback' must be one of: {', '.join(sorted(FEEDBACK_VALUES))}.", "invalid_feedback"
        )

    disease_name = (data.get("diseaseName") or data.get("disease_name") or "").strip()
    if not disease_name:
        raise ValidationError("'diseaseName' is required.", "required_field_missing")

    try:
        index = int(data.get("recommendationIndex") or 0)
    except (TypeError, ValueError):
        index = 0

    saved = save_feedback(
        case_id=case.id,
        recommendation_id=data.get("recommendationId") or None,
        recommendation_index=index,
        disease_name=disease_name,
        decision=decision,
        feedback=feedback,
        doctor_id=actor.id,
    )
    log_audit(
        action="ai.feedback_recorded",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=case.id,
        detail={"decision": decision, "feedback": feedback, "diseaseName": disease_name},
    )
    return {
        "id": saved.id,
        "caseId": saved.case_id,
        "decision": saved.decision,
        "feedback": saved.feedback,
        "diseaseName": saved.disease_name,
        "timestamp": saved.timestamp.isoformat() if saved.timestamp else None,
    }


def list_test_catalogue() -> list[dict]:
    """Master test catalogue (see app/ai/feature_engine.DEFAULT_DISEASE_TESTS).

    Empty until an admin/staff member records the facility's own catalogue; the
    endpoint returns an empty list rather than inventing lab tests.
    """
    return [{"id": t.id, "name": t.name, "description": t.description} for t in recommendation_repo.get_test_catalog()]