"""Recommendations: AI recommendations + recommended-test assignments."""
from __future__ import annotations

from app.extensions import db
from app.utils import gen_uuid
from . import AssignmentStatus


class AIRecommendation(db.Model):
    """One AI-suggested condition + recommended tests, tied to a case.

    AI output is clinical *decision support* — never an autonomous final
    diagnosis. ``reasoning_factors`` and ``recommended_tests`` are JSON arrays.
    """

    __tablename__ = "ai_recommendations"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=False, index=True)

    disease_name = db.Column(db.String(128), nullable=False)
    confidence = db.Column(db.String(16), nullable=False)  # High/Medium/Low
    confidence_score = db.Column(db.Float, nullable=True)  # 0..1
    top_symptoms_summary = db.Column(db.Text, nullable=True)
    reasoning_factors = db.Column(db.JSON, nullable=False, default=list)
    recommended_tests = db.Column(db.JSON, nullable=False, default=list)  # [{id,name}]
    raw_output = db.Column(db.JSON, nullable=True)  # original model output, for audit/learning
    model_version = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)

    case = db.relationship("PatientCase", back_populates="ai_recommendations")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "diseaseName": self.disease_name,
            "confidence": self.confidence,
            "confidenceScore": self.confidence_score,
            "topSymptomsSummary": self.top_symptoms_summary,
            "reasoningFactors": self.reasoning_factors or [],
            "recommendedTests": self.recommended_tests or [],
            "createdAt": self.created_at.isoformat() if self.created_at else None,
        }


class RecommendedTest(db.Model):
    """Master catalogue of tests (mRDT, Widal, ECG, ...)."""

    __tablename__ = "recommended_tests"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    name = db.Column(db.String(128), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)


class RecommendedTestAssignment(db.Model):
    """A doctor-approved set of tests dispatched to a nurse.

    Status flow: pending -> sent -> acknowledged -> completed
    """

    __tablename__ = "recommended_test_assignments"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=gen_uuid)

    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=False, index=True)
    patient_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    nurse_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True, index=True)

    recommendation_id = db.Column(db.String(36), db.ForeignKey("ai_recommendations.id"), nullable=True)
    tests = db.Column(db.JSON, nullable=False, default=list)  # [{id, name, type}]

    status = db.Column(db.String(24), nullable=False, default="pending", index=True)

    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now(), nullable=False)
    sent_at = db.Column(db.DateTime, nullable=True)
    acknowledged_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    case = db.relationship("PatientCase")
    recommendation = db.relationship("AIRecommendation")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "caseId": self.case_id,
            "patientId": self.patient_id,
            "nurseId": self.nurse_id,
            "doctorId": self.doctor_id,
            "tests": self.tests or [],
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "sentAt": self.sent_at.isoformat() if self.sent_at else None,
            "acknowledgedAt": self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
        }
