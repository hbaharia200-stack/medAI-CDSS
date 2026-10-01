"""Repositories for audit log and recommendation feedback."""
from __future__ import annotations

from app.extensions import db
from app.models import AuditLog, FeedbackRecord


def log_audit(
    action: str,
    user_id: str | None = None,
    role: str | None = None,
    patient_case_id: str | None = None,
    detail: dict | None = None,
) -> AuditLog:
    entry = AuditLog(
        user_id=user_id,
        role=role,
        patient_case_id=patient_case_id,
        action=action,
        detail=detail,
    )
    db.session.add(entry)
    db.session.commit()
    return entry


def list_audit_logs() -> list[AuditLog]:
    return db.session.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()


def save_feedback(
    case_id: str,
    recommendation_id: str | None,
    recommendation_index: int,
    disease_name: str,
    decision: str,
    feedback: str | None,
    doctor_id: str,
) -> FeedbackRecord:
    rec = FeedbackRecord(
        case_id=case_id,
        recommendation_id=recommendation_id,
        recommendation_index=recommendation_index,
        disease_name=disease_name,
        decision=decision,
        feedback=feedback,
        doctor_id=doctor_id,
    )
    db.session.add(rec)
    db.session.commit()
    return rec
