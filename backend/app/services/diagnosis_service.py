"""Diagnosis workflow.

Only doctors (and admins) may create/confirm a diagnosis. An AI recommendation
is *never* promoted to a diagnosis automatically: the doctor either records
their own diagnosis or explicitly confirms one from the suggestion list, and the
confirmation is stored with who/when so it is auditable.
"""
from __future__ import annotations

from datetime import datetime

from app.extensions import db
from app.models import CaseStatus, Diagnosis, UserRole
from app.repositories import case_repo, log_audit, save_feedback
from app.utils import AuthError, NotFoundError, ValidationError

SEVERITIES = {"mild", "moderate", "severe", "critical"}


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


def require_clinician(actor) -> None:
    if _role(actor) not in (UserRole.doctor.value, UserRole.admin.value):
        raise AuthError("forbidden_role", "Only a doctor may record a diagnosis.", 403)


def _case_or_404(case_id: str):
    case = case_repo.get_case(case_id)
    if case is None:
        raise NotFoundError("Clinical case not found.")
    return case


def _diagnosis_or_404(diagnosis_id: str) -> Diagnosis:
    record = db.session.get(Diagnosis, diagnosis_id)
    if record is None:
        raise NotFoundError("Diagnosis not found.")
    return record


def _clean_disease_name(value) -> str:
    name = str(value or "").strip()
    if not name:
        raise ValidationError("'diseaseName' is required.", "required_field_missing")
    if len(name) > 128:
        raise ValidationError("'diseaseName' must be 128 characters or fewer.", "invalid_disease_name")
    return name


def _clean_severity(value) -> str | None:
    if value in (None, "", "none"):
        return None
    if value not in SEVERITIES:
        raise ValidationError(
            f"'severity' must be one of: {', '.join(sorted(SEVERITIES))}.", "invalid_severity"
        )
    return value


def list_diagnoses(case_id: str, actor) -> list[dict]:
    case = _case_or_404(case_id)
    if _role(actor) == UserRole.patient.value and case.patient_id != actor.id:
        raise AuthError("forbidden_case", "You do not have access to this case.", 403)
    return [d.to_dict() for d in sorted(case.diagnoses or [], key=lambda d: d.recorded_at)]


def list_diagnoses_facility(actor) -> list[dict]:
    """Facility-wide diagnosis list for dashboards.

    Admins/doctors/nurses see all; a patient would only ever reach the
    case-scoped endpoints (this one is behind the staff role guard).
    """
    role = _role(actor)
    query = db.session.query(Diagnosis).order_by(Diagnosis.recorded_at.desc())
    if role == UserRole.doctor.value:
        query = query.filter(Diagnosis.doctor_id == actor.id)
    return [d.to_dict() for d in query.limit(200).all()]


def create_diagnosis(case_id: str, data: dict, actor) -> dict:
    require_clinician(actor)
    case = _case_or_404(case_id)

    diagnosis = Diagnosis(
        case_id=case.id,
        doctor_id=actor.id,
        disease_name=_clean_disease_name(data.get("diseaseName") or data.get("disease_name")),
        notes=data.get("notes"),
        severity=_clean_severity(data.get("severity")),
        is_primary=bool(data.get("isPrimary", True)),
        ai_recommendation_id=data.get("recommendationId") or None,
        confirmed=bool(data.get("confirmed", False)),
    )
    if diagnosis.confirmed:
        diagnosis.confirmed_at = datetime.utcnow()
        diagnosis.confirmed_by = actor.id

    db.session.add(diagnosis)
    if case.status != CaseStatus.completed:
        case.status = CaseStatus.in_review
    db.session.commit()

    log_audit(
        action="diagnosis.created",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=case.id,
        detail={"diseaseName": diagnosis.disease_name, "confirmed": diagnosis.confirmed},
    )
    return diagnosis.to_dict()


def update_diagnosis(diagnosis_id: str, data: dict, actor) -> dict:
    require_clinician(actor)
    record = _diagnosis_or_404(diagnosis_id)
    if _role(actor) == UserRole.doctor.value and record.doctor_id != actor.id:
        raise AuthError("forbidden_diagnosis", "This diagnosis was recorded by another doctor.", 403)
    if record.confirmed and not data.get("force"):
        raise ValidationError(
            "A confirmed diagnosis cannot be edited without 'force': true (audit-logged).",
            "diagnosis_confirmed",
        )

    if data.get("diseaseName") or data.get("disease_name"):
        record.disease_name = _clean_disease_name(data.get("diseaseName") or data.get("disease_name"))
    if "notes" in data:
        record.notes = data.get("notes")
    if data.get("severity"):
        record.severity = _clean_severity(data["severity"])
    if "isPrimary" in data:
        record.is_primary = bool(data.get("isPrimary"))
    db.session.commit()

    log_audit(
        action="diagnosis.updated",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=record.case_id,
        detail={"diagnosisId": record.id, "forced": bool(data.get("force"))},
    )
    return record.to_dict()


def confirm_diagnosis(diagnosis_id: str, actor) -> dict:
    require_clinician(actor)
    record = _diagnosis_or_404(diagnosis_id)
    if _role(actor) == UserRole.doctor.value and record.doctor_id != actor.id:
        raise AuthError("forbidden_diagnosis", "This diagnosis was recorded by another doctor.", 403)

    record.confirmed = True
    record.confirmed_at = datetime.utcnow()
    record.confirmed_by = actor.id

    case = case_repo.get_case(record.case_id)
    if case is not None:
        case.status = CaseStatus.completed

    db.session.commit()
    log_audit(
        action="diagnosis.confirmed",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=record.case_id,
        detail={"diagnosisId": record.id, "diseaseName": record.disease_name},
    )
    return record.to_dict()


def confirm_recommendation(case_id: str, data: dict, actor) -> dict:
    """Doctor confirms an AI suggestion as the diagnosis (frontend contract).

    Creates the Diagnosis from the doctor's confirmation, marks it confirmed,
    completes the case and records the learning-loop feedback — all in one
    transaction. The AI suggestion itself is never treated as final until this
    explicit, attributed action happens.
    """
    require_clinician(actor)
    case = _case_or_404(case_id)
    disease_name = _clean_disease_name(data.get("diseaseName") or data.get("disease_name"))

    record = Diagnosis(
        case_id=case.id,
        doctor_id=actor.id,
        disease_name=disease_name,
        notes=data.get("notes"),
        severity=_clean_severity(data.get("severity")),
        is_primary=True,
        ai_recommendation_id=data.get("recommendationId") or None,
        confirmed=True,
        confirmed_at=datetime.utcnow(),
        confirmed_by=actor.id,
    )
    db.session.add(record)
    case.status = CaseStatus.completed
    db.session.commit()

    save_feedback(
        case_id=case.id,
        recommendation_id=data.get("recommendationId") or None,
        recommendation_index=int(data.get("recommendationIndex") or 0),
        disease_name=disease_name,
        decision="confirmed",
        feedback=data.get("feedback"),
        doctor_id=actor.id,
    )
    log_audit(
        action="diagnosis.confirmed_from_recommendation",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=case.id,
        detail={"diseaseName": disease_name},
    )
    return record.to_dict()


def reject_recommendation(case_id: str, data: dict, actor) -> dict:
    """Doctor rejects an AI suggestion ('Not this — adjust') and keeps reviewing."""
    require_clinician(actor)
    case = _case_or_404(case_id)
    disease_name = _clean_disease_name(data.get("diseaseName") or data.get("disease_name"))

    save_feedback(
        case_id=case.id,
        recommendation_id=data.get("recommendationId") or None,
        recommendation_index=int(data.get("recommendationIndex") or 0),
        disease_name=disease_name,
        decision="adjusted",
        feedback=data.get("feedback"),
        doctor_id=actor.id,
    )
    if case.status == CaseStatus.awaiting_review:
        case.status = CaseStatus.in_review
        db.session.commit()

    log_audit(
        action="ai.recommendation_rejected",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=case.id,
        detail={"diseaseName": disease_name},
    )
    return {
        "caseId": case.id,
        "diseaseName": disease_name,
        "decision": "adjusted",
        "status": case.status.value if hasattr(case.status, "value") else case.status,
    }


def list_feedback(case_id: str, actor) -> list[dict]:
    case = _case_or_404(case_id)
    if _role(actor) == UserRole.patient.value and case.patient_id != actor.id:
        raise AuthError("forbidden_case", "You do not have access to this case.", 403)

    from app.models import FeedbackRecord

    records = (
        db.session.query(FeedbackRecord)
        .filter_by(case_id=case.id)
        .order_by(FeedbackRecord.timestamp.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "caseId": r.case_id,
            "recommendationId": r.recommendation_id,
            "recommendationIndex": r.recommendation_index,
            "diseaseName": r.disease_name,
            "decision": r.decision,
            "feedback": r.feedback,
            "doctorId": r.doctor_id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in records
    ]