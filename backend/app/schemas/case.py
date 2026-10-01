"""Serialization for patients and clinical cases."""
from __future__ import annotations

from . import _dt, serialize_patient


def serialize_patient_detail(user, profile) -> dict:
    return serialize_patient(user, profile)


def serialize_vital(v) -> dict:
    return {
        "id": v.id,
        "caseId": v.case_id,
        "temperatureC": v.temperature_c,
        "bloodPressureSystolic": v.blood_pressure_systolic,
        "bloodPressureDiastolic": v.blood_pressure_diastolic,
        "heartRate": v.heart_rate,
        "respiratoryRate": v.respiratory_rate,
        "oxygenSaturation": v.oxygen_saturation,
        "bloodGlucoseMgDl": v.blood_glucose_mg_dl,
        "weightKg": v.weight_kg,
        "urgentFlag": v.urgent_flag,
        "recordedBy": v.recorded_by,
        "recordedAt": _dt(v.recorded_at),
    }


def serialize_symptom(s) -> dict:
    return {
        "id": s.id,
        "caseId": s.case_id,
        "label": s.label,
        "bodyRegion": s.body_region,
        "severity": s.severity,
        "durationDays": s.duration_days,
        "notes": s.notes,
    }


def serialize_case(case, include_nested: bool = True) -> dict:
    out = {
        "id": case.id,
        "uuid": getattr(case, "uuid", case.id),
        "patientId": case.patient_id,
        "nurseId": case.nurse_id,
        "doctorId": case.doctor_id,
        "chiefComplaint": case.chief_complaint,
        "status": case.status.value if hasattr(case.status, "value") else case.status,
        "urgent": case.urgent,
        "createdAt": _dt(case.created_at),
        "updatedAt": _dt(case.updated_at),
    }
    if include_nested and case.patient_id:
        out["patient"] = {"id": case.patient_id}
    if include_nested:
        out["symptoms"] = [serialize_symptom(s) for s in (case.symptoms or [])]
        out["vitals"] = [serialize_vital(v) for v in (case.vitals or [])]
        out["history"] = [h.entry for h in (case.medical_history or [])]
        out["diagnoses"] = [
            {"id": d.id, "diseaseName": d.disease_name, "notes": d.notes,
             "severity": d.severity, "doctorId": d.doctor_id, "recordedAt": _dt(d.recorded_at)}
            for d in (case.diagnoses or [])
        ]
        out["aiRecommendations"] = [r.to_dict() for r in (case.ai_recommendations or [])]
        out["assignments"] = [a.to_dict() for a in (case.assignments or [])]
    return out


# ---------------------------------------------------------------------------
# Frontend contract serializers (web/src/types + shared-types/caseTypes.ts)
# ---------------------------------------------------------------------------


def serialize_patient_brief(user, profile=None) -> dict:
    """Patient block used inside the dashboard ``Case`` type."""
    if user is None:
        return {"id": None, "name": "Unknown patient", "age": None, "sex": "F", "phone": None, "language": "en"}
    if profile is None:
        profile = getattr(user, "patient_profile", None)
    sex = (profile.sex if profile and profile.sex else None) or "F"
    return {
        "id": user.id,
        "name": user.full_name,
        "age": profile.age if profile else None,
        "sex": sex.upper() if isinstance(sex, str) else sex,
        "phone": user.phone,
        "language": user.language or "en",
    }


def serialize_vital_signs(v) -> dict | None:
    """``VitalSigns`` shape (single reading) used by the dashboard panel."""
    if v is None:
        return None
    return {
        "temperatureC": v.temperature_c,
        "bloodPressureSystolic": v.blood_pressure_systolic,
        "bloodPressureDiastolic": v.blood_pressure_diastolic,
        "heartRate": v.heart_rate,
        "respiratoryRate": v.respiratory_rate,
        "oxygenSaturation": v.oxygen_saturation,
        "bloodGlucoseMgDl": v.blood_glucose_mg_dl,
        "weightKg": v.weight_kg,
        "recordedAt": _dt(v.recorded_at),
    }


def _latest_vital(case):
    readings = list(case.vitals or [])
    if not readings:
        return None
    return max(readings, key=lambda v: (v.recorded_at is None, v.recorded_at or 0))


def serialize_case_full(case, *, arrival_order: int | None = None) -> dict:
    """Serialize a case into the exact shape the web dashboard renders.

    Matches ``web/src/types`` ``Case`` (and ``shared-types/caseTypes.ts``):
    ``{id, patient, chiefComplaint, symptoms, followUpAnswers, vitals, urgent,
      status, createdAt, history}`` — plus a few read-only extras
    (``nurseId``/``doctorId``/``hasVitals``/``latestVitals``/``diagnoses``)
    that the API documents for staff screens.

    Follow-up answers and location are preserved from the submitted intake.
    AI recommendations and reasoning remain in the doctor-only endpoints.
    """
    return {
        "id": case.id,
        "patient": serialize_patient_brief(case.patient),
        "chiefComplaint": case.chief_complaint,
        "symptoms": [serialize_symptom(s) for s in (case.symptoms or [])],
        "followUpAnswers": case.follow_up_answers or [],
        "vitals": serialize_vital_signs(_latest_vital(case)),
        "urgent": case.urgent,
        "status": case.status.value if hasattr(case.status, "value") else case.status,
        "createdAt": _dt(case.created_at),
        "history": [h.entry for h in (case.medical_history or [])],
        "location": case.location,
        # Extras (staff-facing).
        "nurseId": case.nurse_id,
        "doctorId": case.doctor_id,
        "hasVitals": bool(case.vitals),
        "latestVitals": serialize_vital_signs(_latest_vital(case)),
        "diagnoses": [
            {"id": d.id, "diseaseName": d.disease_name, "notes": d.notes,
             "severity": d.severity, "doctorId": d.doctor_id, "recordedAt": _dt(d.recorded_at)}
            for d in (case.diagnoses or [])
        ],
        "arrivalOrder": arrival_order,
    }


def serialize_queue(cases: list) -> list[dict]:
    """``QueueCase[]`` — ``{case, arrivalOrder}`` keyed by arrival order."""
    return [
        {"case": serialize_case_full(c, arrival_order=idx), "arrivalOrder": idx}
        for idx, c in enumerate(cases)
    ]
