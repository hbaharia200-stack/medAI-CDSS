"""Serialization for dashboard & statistics aggregation responses."""
from __future__ import annotations

from . import _dt


def serialize_dashboard(payload: dict) -> dict:
    """Normalize a dashboard dict into a JSON-safe shape."""
    def _list(xs):
        return [_dt(x) if hasattr(x, "isoformat") else x for x in (xs or [])]

    return {
        "activePatients": payload.get("active_patients", 0),
        "totalPatients": payload.get("total_patients", 0),
        # The web BasicDashboard reads `openCases`; it was missing from this
        # payload, so the card silently rendered 0 regardless of the database.
        "openCases": payload.get("open_cases", 0),
        "appointmentsToday": payload.get("appointments_today", 0),
        "appointmentsUpcoming": payload.get("appointments_upcoming", 0),
        "pendingRecommendations": payload.get("pending_recommendations", 0),
        "urgentCases": payload.get("urgent_cases", 0),
        "diagnosisStats": payload.get("diagnosis_stats", []),
        "recentActivities": payload.get("recent_activities", []),
        "patientGrowth": payload.get("patient_growth", []),
        "genderDistribution": payload.get("gender_distribution", []),
        "ageDistribution": payload.get("age_distribution", []),
        "performance": payload.get("performance", []),
        "generatedAt": _dt(payload.get("generated_at")),
    }


def serialize_statistics(payload: dict) -> dict:
    return payload
