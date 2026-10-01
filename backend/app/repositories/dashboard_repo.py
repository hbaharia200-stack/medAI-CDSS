"""Dashboard / statistics aggregation queries.

Everything here is derived from rows actually present in the database. When
there is no data the functions return zeros / empty lists — never random or
placeholder statistics.
"""
from __future__ import annotations

import datetime

from app.extensions import db
from app.models import (
    AIRecommendation,
    Appointment,
    AppointmentStatus,
    CaseStatus,
    Diagnosis,
    FeedbackRecord,
    PatientCase,
    PatientProfile,
    RecommendedTestAssignment,
    User,
    UserRole,
)


def _count(query) -> int:
    return int(query.count())


def _day_bounds(day: datetime.date) -> tuple[datetime.datetime, datetime.datetime]:
    start = datetime.datetime.combine(day, datetime.time.min)
    return start, start + datetime.timedelta(days=1)


# ---------------------------------------------------------------------------
# Overview counters
# ---------------------------------------------------------------------------


def _scoped_cases(doctor_id: str | None):
    """Cases a doctor is responsible for: theirs, plus not-yet-claimed ones.

    An unassigned case is still in that doctor's queue awaiting review, so
    filtering on ``doctor_id == me`` alone under-counted badly — it reported
    zero open/urgent cases while the same doctor could plainly see them in the
    queue. Scope is therefore "mine, or not yet claimed by anyone".
    """
    q = db.session.query(PatientCase)
    if doctor_id:
        q = q.filter(
            db.or_(PatientCase.doctor_id == doctor_id, PatientCase.doctor_id.is_(None))
        )
    return q


def overview(doctor_id: str | None = None) -> dict:
    today = datetime.date.today()
    start, end = _day_bounds(today)

    open_case_q = _scoped_cases(doctor_id).filter(PatientCase.status != CaseStatus.completed)
    active_patient_ids = {c.patient_id for c in open_case_q.all()}

    appt_q = db.session.query(Appointment)
    if doctor_id:
        appt_q = appt_q.filter(Appointment.doctor_id == doctor_id)

    return {
        "active_patients": len(active_patient_ids),
        "total_patients": _count(db.session.query(User).filter(User.role == UserRole.patient)),
        "open_cases": _count(open_case_q),
        "urgent_cases": _count(open_case_q.filter(PatientCase.urgent.is_(True))),
        "awaiting_review": _count(open_case_q.filter(PatientCase.status == CaseStatus.awaiting_review)),
        "appointments_today": _count(
            appt_q.filter(Appointment.start_time >= start, Appointment.start_time < end)
        ),
        "appointments_upcoming": _count(
            appt_q.filter(
                Appointment.start_time >= end,
                Appointment.status.in_([AppointmentStatus.pending, AppointmentStatus.confirmed]),
            )
        ),
        "appointments_pending": _count(appt_q.filter(Appointment.status == AppointmentStatus.pending)),
        "pending_recommendations": _count(
            db.session.query(RecommendedTestAssignment).filter(
                RecommendedTestAssignment.status.in_(["pending", "sent"])
            )
        ),
        "ai_recommendations_total": _count(db.session.query(AIRecommendation)),
        "diagnoses_total": _count(db.session.query(Diagnosis)),
        "doctors": _count(db.session.query(User).filter(User.role == UserRole.doctor)),
        "nurses": _count(db.session.query(User).filter(User.role == UserRole.nurse)),
    }


# ---------------------------------------------------------------------------
# Distributions (aggregated in Python: dialect-agnostic across PG/SQLite)
# ---------------------------------------------------------------------------


def diagnosis_distribution(limit: int = 8, doctor_id: str | None = None) -> list[dict]:
    q = db.session.query(Diagnosis.disease_name, db.func.count(Diagnosis.id))
    if doctor_id:
        q = q.filter(Diagnosis.doctor_id == doctor_id)
    rows = (
        q.group_by(Diagnosis.disease_name)
        .order_by(db.func.count(Diagnosis.id).desc())
        .limit(limit)
        .all()
    )
    return [{"diseaseName": name, "count": int(count)} for name, count in rows]


def gender_distribution() -> list[dict]:
    rows = (
        db.session.query(PatientProfile.sex, db.func.count(PatientProfile.user_id))
        .group_by(PatientProfile.sex)
        .all()
    )
    out = []
    for sex, count in rows:
        label = "unspecified" if not sex else ("male" if str(sex).upper() == "M" else "female")
        out.append({"label": label, "count": int(count)})
    return out


def age_distribution() -> list[dict]:
    buckets = [(0, 17, "0-17"), (18, 34, "18-34"), (35, 49, "35-49"), (50, 64, "50-64"), (65, 200, "65+")]
    ages = [r[0] for r in db.session.query(PatientProfile.age).all() if r[0] is not None]
    return [
        {"label": label, "count": sum(1 for a in ages if lo <= int(a) <= hi)}
        for lo, hi, label in buckets
    ]


def patient_growth(months: int = 6) -> list[dict]:
    """Patients registered per month over the trailing ``months`` window."""
    cursor = datetime.date.today().replace(day=1)
    window: list[tuple[int, int]] = []
    for _ in range(months):
        window.append((cursor.year, cursor.month))
        cursor = (cursor - datetime.timedelta(days=1)).replace(day=1)
    window.reverse()

    created = [
        r[0]
        for r in db.session.query(User.created_at).filter(User.role == UserRole.patient).all()
        if r[0] is not None
    ]
    counts = {(year, month): 0 for year, month in window}
    for dt in created:
        key = (dt.year, dt.month)
        if key in counts:
            counts[key] += 1
    return [
        {"label": f"{year:04d}-{month:02d}", "count": counts[(year, month)]}
        for year, month in window
    ]


def time_to_decision_hours() -> dict:
    """Mean hours from case creation to first recorded diagnosis."""
    rows = (
        db.session.query(PatientCase.created_at, Diagnosis.recorded_at)
        .join(Diagnosis, Diagnosis.case_id == PatientCase.id)
        .all()
    )
    deltas = [
        (d - c).total_seconds() / 3600.0
        for c, d in rows
        if c is not None and d is not None and d >= c
    ]
    if not deltas:
        return {"samples": 0, "averageHours": None}
    return {"samples": len(deltas), "averageHours": round(sum(deltas) / len(deltas), 2)}


def feedback_summary() -> dict:
    rows = (
        db.session.query(FeedbackRecord.decision, db.func.count(FeedbackRecord.id))
        .group_by(FeedbackRecord.decision)
        .all()
    )
    accuracy_rows = (
        db.session.query(FeedbackRecord.feedback, db.func.count(FeedbackRecord.id))
        .filter(FeedbackRecord.feedback.isnot(None))
        .group_by(FeedbackRecord.feedback)
        .all()
    )
    return {
        "decisions": {str(d): int(c) for d, c in rows},
        "accuracy": {str(f): int(c) for f, c in accuracy_rows},
    }