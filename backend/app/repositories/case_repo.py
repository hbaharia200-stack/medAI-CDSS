"""Repositories for clinical cases, symptoms, vitals, history."""
from __future__ import annotations

from app.extensions import db
from app.models import (
    CaseStatus,
    MedicalHistory,
    PatientCase,
    Symptom,
    Vital,
)


def get_case(case_id: str) -> PatientCase | None:
    return db.session.get(PatientCase, case_id)


def get_case_for_user(case_id: str, user_id: str) -> PatientCase | None:
    """Only the patient, assigned nurse, assigned doctor, or an admin may load
    the case. Used for ownership/authorization checks."""
    case = db.session.get(PatientCase, case_id)
    if case is None:
        return None
    if case.patient_id == user_id:
        return case
    if case.nurse_id == user_id or case.doctor_id == user_id:
        return case
    return None


def list_cases_for_patient(patient_id: str) -> list[PatientCase]:
    return (
        db.session.query(PatientCase)
        .filter_by(patient_id=patient_id)
        .order_by(PatientCase.created_at.desc())
        .all()
    )


def list_cases_for_nurse(nurse_id: str) -> list[PatientCase]:
    return (
        db.session.query(PatientCase)
        .filter(PatientCase.nurse_id == nurse_id)
        .order_by(PatientCase.urgent.desc(), PatientCase.created_at.asc())
        .all()
    )


def list_cases_for_doctor(doctor_id: str) -> list[PatientCase]:
    return (
        db.session.query(PatientCase)
        .filter(PatientCase.doctor_id == doctor_id)
        .order_by(PatientCase.urgent.desc(), PatientCase.created_at.asc())
        .all()
    )


def list_all_cases() -> list[PatientCase]:
    return db.session.query(PatientCase).order_by(PatientCase.created_at.desc()).all()


def list_open_cases() -> list[PatientCase]:
    return (
        db.session.query(PatientCase)
        .filter(PatientCase.status != CaseStatus.completed)
        .order_by(PatientCase.urgent.desc(), PatientCase.created_at.asc())
        .all()
    )


def create_case(
    patient_id: str,
    chief_complaint: str,
    symptoms: list[dict] | None = None,
    history: list[str] | None = None,
    urgent: bool = False,
    nurse_id: str | None = None,
    doctor_id: str | None = None,
    location: dict | None = None,
    follow_up_answers: list[dict] | None = None,
) -> PatientCase:
    case = PatientCase(
        patient_id=patient_id,
        chief_complaint=chief_complaint,
        urgent=urgent,
        status=CaseStatus.submitted,
        nurse_id=nurse_id,
        doctor_id=doctor_id,
        location=location,
        follow_up_answers=follow_up_answers or [],
    )
    db.session.add(case)
    db.session.flush()

    for s in symptoms or []:
        db.session.add(
            Symptom(
                case_id=case.id,
                label=s["label"],
                body_region=s.get("bodyRegion"),
                severity=s.get("severity"),
                duration_days=s.get("durationDays"),
                notes=s.get("notes"),
            )
        )
    for h in history or []:
        db.session.add(MedicalHistory(case_id=case.id, entry=h))
    return case


def update_case(case: PatientCase, **fields) -> PatientCase:
    for k, v in fields.items():
        if v is not None:
            setattr(case, k, v)
    db.session.add(case)
    db.session.commit()
    return case


def add_vitals(case_id: str, cleaned_vitals: dict, urgent_flag: bool, recorded_by: str | None) -> Vital:
    case = db.session.get(PatientCase, case_id)
    if case is None:
        raise ValueError("case_not_found")
    v = Vital(
        case_id=case_id,
        temperature_c=cleaned_vitals.get("temperatureC"),
        blood_pressure_systolic=cleaned_vitals.get("bloodPressureSystolic"),
        blood_pressure_diastolic=cleaned_vitals.get("bloodPressureDiastolic"),
        heart_rate=cleaned_vitals.get("heartRate"),
        respiratory_rate=cleaned_vitals.get("respiratoryRate"),
        oxygen_saturation=cleaned_vitals.get("oxygenSaturation"),
        blood_glucose_mg_dl=cleaned_vitals.get("bloodGlucoseMgDl"),
        weight_kg=cleaned_vitals.get("weightKg"),
        urgent_flag=urgent_flag,
        recorded_by=recorded_by,
    )
    db.session.add(v)
    if urgent_flag:
        case.urgent = True
        case.status = CaseStatus.awaiting_review
    elif case.status == CaseStatus.submitted:
        case.status = CaseStatus.doctor_reviewing
    return v


# ---------------------------------------------------------------------------
# Queue + filtered listing (nurse console & doctor dashboard)
# ---------------------------------------------------------------------------


def list_cases_filtered(
    *,
    status: str | None = None,
    patient_id: str | None = None,
    doctor_id: str | None = None,
    nurse_id: str | None = None,
    urgent: bool | None = None,
    include_completed: bool = True,
    order: str = "asc",
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[PatientCase], int]:
    q = db.session.query(PatientCase)
    if status:
        q = q.filter(PatientCase.status == CaseStatus(status))
    elif not include_completed:
        q = q.filter(PatientCase.status != CaseStatus.completed)
    if patient_id:
        q = q.filter(PatientCase.patient_id == patient_id)
    if doctor_id:
        q = q.filter(PatientCase.doctor_id == doctor_id)
    if nurse_id:
        q = q.filter(PatientCase.nurse_id == nurse_id)
    if urgent is not None:
        q = q.filter(PatientCase.urgent.is_(urgent))

    total = q.count()
    ordered = q.order_by(
        PatientCase.urgent.desc(),
        PatientCase.created_at.asc() if order == "asc" else PatientCase.created_at.desc(),
    )
    if offset:
        ordered = ordered.offset(offset)
    if limit is not None:
        ordered = ordered.limit(limit)
    return ordered.all(), total


def queue_cases(
    *, doctor_id: str | None = None, nurse_id: str | None = None, limit: int | None = None
) -> list[PatientCase]:
    """Open cases in clinical order: urgent first, then earliest arrival.

    Unassigned cases are included so a nurse/doctor sees work that has not been
    claimed yet (they are then visible to *every* clinician, which is how the
    intake queue works before hand-off).
    """
    q = db.session.query(PatientCase).filter(PatientCase.status != CaseStatus.completed)
    if doctor_id:
        q = q.filter(
            db.or_(PatientCase.doctor_id == doctor_id, PatientCase.doctor_id.is_(None))
        )
    if nurse_id:
        q = q.filter(
            db.or_(PatientCase.nurse_id == nurse_id, PatientCase.nurse_id.is_(None))
        )
    q = q.order_by(PatientCase.urgent.desc(), PatientCase.created_at.asc())
    if limit:
        q = q.limit(limit)
    return q.all()


# ---------------------------------------------------------------------------
# Mutations
# ---------------------------------------------------------------------------


def save_case(case: PatientCase, *, commit: bool = True) -> PatientCase:
    db.session.add(case)
    if commit:
        db.session.commit()
    return case


def assign_case(
    case: PatientCase, *, doctor_id: str | None = None, nurse_id: str | None = None
) -> PatientCase:
    if doctor_id is not None:
        case.doctor_id = doctor_id
    if nurse_id is not None:
        case.nurse_id = nurse_id
    return save_case(case)


def set_status(case: PatientCase, status: str) -> PatientCase:
    case.status = CaseStatus(status)
    return save_case(case)


def add_symptom(
    case_id: str,
    *,
    label: str,
    body_region: str | None = None,
    severity: int | None = None,
    duration_days: int | None = None,
    notes: str | None = None,
) -> Symptom:
    symptom = Symptom(
        case_id=case_id,
        label=label,
        body_region=body_region,
        severity=severity,
        duration_days=duration_days,
        notes=notes,
    )
    db.session.add(symptom)
    db.session.flush()
    return symptom


def add_history(case_id: str, entry: str, patient_id: str | None = None) -> MedicalHistory:
    item = MedicalHistory(case_id=case_id, patient_id=patient_id, entry=entry)
    db.session.add(item)
    db.session.flush()
    return item


def list_symptoms(case_id: str) -> list[Symptom]:
    return (
        db.session.query(Symptom)
        .filter_by(case_id=case_id)
        .order_by(Symptom.label.asc())
        .all()
    )


def list_vitals(case_id: str) -> list[Vital]:
    return (
        db.session.query(Vital)
        .filter_by(case_id=case_id)
        .order_by(Vital.recorded_at.desc())
        .all()
    )


def latest_vitals(case_id: str) -> Vital | None:
    return (
        db.session.query(Vital)
        .filter_by(case_id=case_id)
        .order_by(Vital.recorded_at.desc())
        .first()
    )


def list_history(case_id: str) -> list[MedicalHistory]:
    return (
        db.session.query(MedicalHistory)
        .filter_by(case_id=case_id)
        .order_by(MedicalHistory.recorded_at.desc())
        .all()
    )
