"""Dashboard + statistics aggregation (real database figures only).

When the database is empty these endpoints return zeros/empty lists — the
frontend is expected to render empty states rather than fabricated charts.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.extensions import db
from app.models import CaseStatus, PatientCase, UserRole
from app.repositories import dashboard_repo, list_audit_logs
from app.schemas.dashboard import serialize_dashboard


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


def _scope_doctor_id(actor) -> str | None:
    """Doctors see their own figures; nurses/admins see the whole facility."""
    return actor.id if _role(actor) == UserRole.doctor.value else None


def _scoped_cases(doctor_id: str | None):
    """Cases a doctor is responsible for: theirs, plus not-yet-claimed ones.

    An unassigned case is still on that doctor's desk — it is in their queue
    and awaiting review by whoever picks it up. Filtering on
    ``doctor_id == me`` alone therefore reported "0 open cases" while the same
    doctor could see the cases in the queue, which is not a truthful
    dashboard. The shared implementation lives in ``dashboard_repo`` so the
    service and the repository can never disagree.
    """
    return dashboard_repo._scoped_cases(doctor_id)


def basic(actor) -> dict:
    doctor_id = _scope_doctor_id(actor)
    payload = dashboard_repo.overview(doctor_id=doctor_id)
    # The dashboard renders these charts, so they must come from real rows
    # rather than defaulting to empty. Each one is a database aggregation; if
    # the table is genuinely empty the series is simply empty.
    payload.update(
        {
            "patient_growth": dashboard_repo.patient_growth(),
            "gender_distribution": dashboard_repo.gender_distribution(),
            "age_distribution": dashboard_repo.age_distribution(),
        }
    )
    payload["generated_at"] = datetime.now(timezone.utc)
    return serialize_dashboard(payload)


def patients(actor) -> dict:
    payload = dashboard_repo.overview(doctor_id=_scope_doctor_id(actor))
    return {
        "activePatients": payload["active_patients"],
        "totalPatients": payload["total_patients"],
        "openCases": payload["open_cases"],
        "urgentCases": payload["urgent_cases"],
        "patientGrowth": dashboard_repo.patient_growth(),
        "genderDistribution": dashboard_repo.gender_distribution(),
        "ageDistribution": dashboard_repo.age_distribution(),
    }


def diagnosis(actor) -> dict:
    doctor_id = _scope_doctor_id(actor)
    payload = dashboard_repo.overview(doctor_id=doctor_id)
    return {
        "diagnosesTotal": payload["diagnoses_total"],
        "awaitingReview": payload["awaiting_review"],
        "aiRecommendationsTotal": payload["ai_recommendations_total"],
        "diagnosisDistribution": dashboard_repo.diagnosis_distribution(doctor_id=doctor_id),
        "timeToDecision": dashboard_repo.time_to_decision_hours(),
        "feedback": dashboard_repo.feedback_summary(),
    }


def appointments(actor) -> dict:
    doctor_id = _scope_doctor_id(actor)
    payload = dashboard_repo.overview(doctor_id=doctor_id)
    return {
        "appointmentsToday": payload["appointments_today"],
        "appointmentsUpcoming": payload["appointments_upcoming"],
        "appointmentsPending": payload["appointments_pending"],
    }


def statistics(actor) -> dict:
    doctor_id = _scope_doctor_id(actor)
    payload = dashboard_repo.overview(doctor_id=doctor_id)
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "overview": {
            "totalPatients": payload["total_patients"],
            "activePatients": payload["active_patients"],
            "openCases": payload["open_cases"],
            "diagnosesTotal": payload["diagnoses_total"],
            "appointmentsToday": payload["appointments_today"],
        },
        "diagnosisDistribution": dashboard_repo.diagnosis_distribution(doctor_id=doctor_id),
        "genderDistribution": dashboard_repo.gender_distribution(),
        "ageDistribution": dashboard_repo.age_distribution(),
        "patientGrowth": dashboard_repo.patient_growth(months=12),
        "timeToDecision": dashboard_repo.time_to_decision_hours(),
        "feedback": dashboard_repo.feedback_summary(),
        "staffing": {
            "doctors": payload["doctors"],
            "nurses": payload["nurses"],
        },
    }


def audit_feed(limit: int = 50) -> list[dict]:
    """Audit-log projection for the admin dashboard (clinical detail included,
    since only admins can read it — never logged to stdout)."""
    entries = list_audit_logs()[:limit]
    return [
        {
            "id": e.id,
            "action": e.action,
            "userId": e.user_id,
            "role": e.role,
            "caseId": e.patient_case_id,
            "detail": e.detail,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
        }
        for e in entries
    ]


def system_health(actor) -> dict:
    """Real service health: database connectivity + row counts + AI status."""
    from app.extensions import db
    from app.services import ai_service

    db_ok = True
    db_error = None
    try:
        db.session.execute(db.text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        db_ok = False
        db_error = type(exc).__name__

    return {
        "database": {"ok": db_ok, "error": db_error},
        "ai": ai_service.model_status(),
        "counts": dashboard_repo.overview(doctor_id=_scope_doctor_id(actor)),
        "checkedAt": datetime.now(timezone.utc).isoformat(),
    }