"""Clinical entities: symptoms, vitals, history, diagnosis."""
from __future__ import annotations

from app.extensions import db
from app.utils import gen_uuid


class Symptom(db.Model):
    __tablename__ = "symptoms"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=False, index=True)
    label = db.Column(db.String(128), nullable=False)
    body_region = db.Column(db.String(64), nullable=True)
    severity = db.Column(db.Integer, nullable=True)  # 1–5
    duration_days = db.Column(db.Integer, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    case = db.relationship("PatientCase", back_populates="symptoms")


class Vital(db.Model):
    """A set of recorded vitals for a case (one row per recording event)."""

    __tablename__ = "vitals"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=False, index=True)

    temperature_c = db.Column(db.Float, nullable=True)
    blood_pressure_systolic = db.Column(db.Float, nullable=True)
    blood_pressure_diastolic = db.Column(db.Float, nullable=True)
    heart_rate = db.Column(db.Float, nullable=True)
    respiratory_rate = db.Column(db.Float, nullable=True)
    oxygen_saturation = db.Column(db.Float, nullable=True)
    blood_glucose_mg_dl = db.Column(db.Float, nullable=True)
    weight_kg = db.Column(db.Float, nullable=True)

    urgent_flag = db.Column(db.Boolean, nullable=False, default=False)
    recorded_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)  # nurse
    recorded_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)

    case = db.relationship("PatientCase", back_populates="vitals")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "case_id": self.case_id,
            "temperatureC": self.temperature_c,
            "bloodPressureSystolic": self.blood_pressure_systolic,
            "bloodPressureDiastolic": self.blood_pressure_diastolic,
            "heartRate": self.heart_rate,
            "respiratoryRate": self.respiratory_rate,
            "oxygenSaturation": self.oxygen_saturation,
            "bloodGlucoseMgDl": self.blood_glucose_mg_dl,
            "weightKg": self.weight_kg,
            "urgentFlag": self.urgent_flag,
            "recordedBy": self.recorded_by,
            "recordedAt": self.recorded_at.isoformat() if self.recorded_at else None,
        }


class MedicalHistory(db.Model):
    """A single free-text history item for a case or patient."""

    __tablename__ = "medical_history"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=True, index=True)
    patient_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True, index=True)
    entry = db.Column(db.Text, nullable=False)
    recorded_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)

    case = db.relationship("PatientCase", back_populates="medical_history")


class Diagnosis(db.Model):
    """A doctor-recorded (final) diagnosis for a case.

    A diagnosis is created from the doctor's own judgement (optionally informed
    by, but never auto-derived from, an AI recommendation). ``confirmed`` makes
    the doctor's sign-off explicit and auditable.
    """

    __tablename__ = "diagnoses"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=False, index=True)
    doctor_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    disease_name = db.Column(db.String(128), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    severity = db.Column(db.String(32), nullable=True)  # mild/moderate/severe/custom
    is_primary = db.Column(db.Boolean, nullable=False, default=True)
    confirmed = db.Column(db.Boolean, nullable=False, default=False, index=True)
    confirmed_at = db.Column(db.DateTime, nullable=True)
    confirmed_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    ai_recommendation_id = db.Column(db.String(36), db.ForeignKey("ai_recommendations.id"), nullable=True)
    recorded_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now(), nullable=False)

    case = db.relationship("PatientCase", back_populates="diagnoses")

    def to_dict(self) -> dict:
        from app.schemas import _dt

        return {
            "id": self.id,
            "caseId": self.case_id,
            "doctorId": self.doctor_id,
            "diseaseName": self.disease_name,
            "notes": self.notes,
            "severity": self.severity,
            "isPrimary": self.is_primary,
            "confirmed": self.confirmed,
            "confirmedAt": _dt(self.confirmed_at),
            "confirmedBy": self.confirmed_by,
            "aiRecommendationId": self.ai_recommendation_id,
            "recordedAt": _dt(self.recorded_at),
            "updatedAt": _dt(self.updated_at),
        }
