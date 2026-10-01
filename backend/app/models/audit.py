"""Audit trail + recommendation feedback (learning loop)."""
from __future__ import annotations

from app.extensions import db
from app.utils import gen_uuid


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True, index=True)
    role = db.Column(db.String(16), nullable=True)
    patient_case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=True)
    action = db.Column(db.String(128), nullable=False)
    detail = db.Column(db.JSON, nullable=True)  # arbitrary structured context
    timestamp = db.Column(db.DateTime, default=db.func.now(), nullable=False, index=True)


class FeedbackRecord(db.Model):
    """A doctor's feedback on an AI recommendation (decision + accuracy)."""

    __tablename__ = "feedback_records"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=False, index=True)
    recommendation_id = db.Column(db.String(36), db.ForeignKey("ai_recommendations.id"), nullable=True)
    recommendation_index = db.Column(db.Integer, nullable=False)
    disease_name = db.Column(db.String(128), nullable=False)
    decision = db.Column(db.String(16), nullable=False)  # confirmed | adjusted
    feedback = db.Column(db.String(32), nullable=True)   # accurate | partially_accurate | not_accurate
    doctor_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, default=db.func.now(), nullable=False)
