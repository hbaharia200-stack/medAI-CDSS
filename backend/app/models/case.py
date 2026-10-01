"""Clinical case model."""
from __future__ import annotations

from app.extensions import db
from app.utils import gen_uuid
from . import CaseStatus


class PatientCase(db.Model):
    """A single clinical encounter / episode for a patient.

    Status flow: intake_pending -> vitals_pending -> awaiting_review
                 -> in_review -> completed
    """

    __tablename__ = "patient_cases"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=gen_uuid)

    patient_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    nurse_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True, index=True)
    doctor_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True, index=True)

    chief_complaint = db.Column(db.Text, nullable=False)
    status = db.Column(
        db.Enum(CaseStatus, native_enum=False, length=24),
        nullable=False,
        default=CaseStatus.intake_pending,
        index=True,
    )
    location = db.Column(db.JSON, nullable=True)
    follow_up_answers = db.Column(db.JSON, nullable=True)
    urgent = db.Column(db.Boolean, nullable=False, default=False, index=True)

    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now(), nullable=False)

    # Relationships
    symptoms = db.relationship("Symptom", back_populates="case", cascade="all, delete-orphan", lazy="select")
    vitals = db.relationship("Vital", back_populates="case", cascade="all, delete-orphan", lazy="select")
    medical_history = db.relationship("MedicalHistory", back_populates="case", cascade="all, delete-orphan", lazy="select")
    diagnoses = db.relationship("Diagnosis", back_populates="case", cascade="all, delete-orphan", lazy="select")
    ai_recommendations = db.relationship("AIRecommendation", back_populates="case", cascade="all, delete-orphan", lazy="select")
    assignments = db.relationship("RecommendedTestAssignment", back_populates="case", cascade="all, delete-orphan", lazy="select")

    patient = db.relationship("User", foreign_keys=[patient_id], backref="cases_as_patient")
    nurse = db.relationship("User", foreign_keys=[nurse_id], backref="cases_as_nurse")
    doctor = db.relationship("User", foreign_keys=[doctor_id], backref="cases_as_doctor")
