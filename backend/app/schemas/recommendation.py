"""Serialization for clinical cases is in schemas/case.py; this file adds
recommendation assignment serialization helpers."""
from __future__ import annotations

from app.extensions import db
from app.models import User

from . import _dt


def serialize_recommendation_assignment(a) -> dict:
    """Serialize a test assignment for a clinician.

    The identifiers stay in the payload (they matter for audit and for the
    status PATCH route), but they are no longer the *only* label available:
    the real patient name, a short case reference and the recommending doctor
    are resolved here, at the API boundary, so no client has to display a raw
    UUID as if it were a person's name.
    """
    # Resolved from the database, never fabricated.
    patient = db.session.get(User, a.patient_id) if a.patient_id else None
    doctor = db.session.get(User, a.doctor_id) if a.doctor_id else None

    return {
        "id": a.id,
        "caseId": a.case_id,
        # Short, human-scannable reference; the full UUID is still "caseId".
        "caseReference": a.case_id[:8] if a.case_id else None,
        "patientId": a.patient_id,
        "patientName": patient.full_name if patient else None,
        "patientPhone": patient.phone if patient else None,
        "nurseId": a.nurse_id,
        "doctorId": a.doctor_id,
        "doctorName": doctor.full_name if doctor else None,
        "recommendationId": a.recommendation_id,
        "tests": a.tests or [],
        "status": a.status,
        "createdAt": _dt(a.created_at),
        "sentAt": _dt(a.sent_at),
        "acknowledgedAt": _dt(a.acknowledged_at),
        "completedAt": _dt(a.completed_at),
    }
