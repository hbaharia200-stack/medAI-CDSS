"""Repositories for recommendations and recommended-test assignments."""
from __future__ import annotations

from app.extensions import db
from app.models import (
    AIRecommendation,
    RecommendedTest,
    RecommendedTestAssignment,
)


def get_recommendation(rid: str) -> AIRecommendation | None:
    return db.session.get(AIRecommendation, rid)


def list_recommendations_for_case(case_id: str) -> list[AIRecommendation]:
    return (
        db.session.query(AIRecommendation)
        .filter_by(case_id=case_id)
        .order_by(AIRecommendation.created_at.desc())
        .all()
    )


def save_recommendation(
    case_id: str,
    disease_name: str,
    confidence: str,
    confidence_score: float | None,
    top_symptoms_summary: str | None,
    reasoning_factors: list[str],
    recommended_tests: list[dict],
    raw_output: dict | None = None,
    model_version: str | None = None,
) -> AIRecommendation:
    rec = AIRecommendation(
        case_id=case_id,
        disease_name=disease_name,
        confidence=confidence,
        confidence_score=confidence_score,
        top_symptoms_summary=top_symptoms_summary,
        reasoning_factors=reasoning_factors,
        recommended_tests=recommended_tests,
        raw_output=raw_output,
        model_version=model_version,
    )
    db.session.add(rec)
    db.session.flush()
    return rec


def get_test_catalog() -> list[RecommendedTest]:
    return db.session.query(RecommendedTest).order_by(RecommendedTest.name).all()


def get_test_by_name(name: str) -> RecommendedTest | None:
    return db.session.query(RecommendedTest).filter(
        db.func.lower(RecommendedTest.name) == name.strip().lower()
    ).first()


def get_assignment(aid: str) -> RecommendedTestAssignment | None:
    return db.session.get(RecommendedTestAssignment, aid)


def list_assignments_for_nurse(nurse_id: str) -> list[RecommendedTestAssignment]:
    return (
        db.session.query(RecommendedTestAssignment)
        .filter_by(nurse_id=nurse_id)
        .order_by(RecommendedTestAssignment.created_at.desc())
        .all()
    )


def list_assignments_for_case(case_id: str) -> list[RecommendedTestAssignment]:
    return (
        db.session.query(RecommendedTestAssignment)
        .filter_by(case_id=case_id)
        .order_by(RecommendedTestAssignment.created_at.desc())
        .all()
    )


def count_pending_for_nurse(nurse_id: str) -> int:
    from app.models import AssignmentStatus  # local import avoids cycle at import time
    return (
        db.session.query(RecommendedTestAssignment)
        .filter(
            RecommendedTestAssignment.nurse_id == nurse_id,
            RecommendedTestAssignment.status.in_(["pending", "sent"]),
        )
        .count()
    )


def assign_tests_to_nurse(
    case_id: str,
    patient_id: str,
    doctor_id: str,
    tests: list[dict],
    recommendation_id: str | None = None,
    nurse_id: str | None = None,
) -> RecommendedTestAssignment:
    assignment = RecommendedTestAssignment(
        case_id=case_id,
        patient_id=patient_id,
        doctor_id=doctor_id,
        nurse_id=nurse_id,
        recommendation_id=recommendation_id,
        tests=tests,
        status="pending",
    )
    db.session.add(assignment)
    db.session.flush()
    return assignment


def update_assignment_status(assignment: RecommendedTestAssignment, status: str) -> RecommendedTestAssignment:
    from datetime import datetime
    assignment.status = status
    now = datetime.utcnow()
    if status == "sent" and assignment.sent_at is None:
        assignment.sent_at = now
    elif status == "acknowledged" and assignment.acknowledged_at is None:
        assignment.acknowledged_at = now
    elif status == "completed" and assignment.completed_at is None:
        assignment.completed_at = now
    db.session.add(assignment)
    db.session.commit()
    return assignment


# ---------------------------------------------------------------------------
# Filtered listing (nurse console, doctor dashboard, admin)
# ---------------------------------------------------------------------------


def list_assignments_filtered(
    *,
    nurse_id: str | None = None,
    doctor_id: str | None = None,
    patient_id: str | None = None,
    case_id: str | None = None,
    status: str | None = None,
    include_unassigned: bool = False,
    limit: int | None = None,
    offset: int = 0,
) -> tuple[list[RecommendedTestAssignment], int]:
    """Filtered assignment listing.

    ``include_unassigned`` mirrors ``case_repo.queue_cases``: a nurse's own
    inbox also shows doctor-approved work that no specific nurse has been
    addressed yet (``nurse_id IS NULL``), so pressing "Send to Nurse" without
    picking a colleague still reaches the nursing pool. Explicit
    ``/nurses/<id>/recommendations`` lookups leave it ``False`` so a named
    nurse's list stays exact.
    """
    q = db.session.query(RecommendedTestAssignment)
    if nurse_id:
        if include_unassigned:
            q = q.filter(
                db.or_(
                    RecommendedTestAssignment.nurse_id == nurse_id,
                    RecommendedTestAssignment.nurse_id.is_(None),
                )
            )
        else:
            q = q.filter(RecommendedTestAssignment.nurse_id == nurse_id)
    if doctor_id:
        q = q.filter(RecommendedTestAssignment.doctor_id == doctor_id)
    if patient_id:
        q = q.filter(RecommendedTestAssignment.patient_id == patient_id)
    if case_id:
        q = q.filter(RecommendedTestAssignment.case_id == case_id)
    if status:
        q = q.filter(RecommendedTestAssignment.status == status)

    total = q.count()
    ordered = q.order_by(RecommendedTestAssignment.created_at.desc())
    if offset:
        ordered = ordered.offset(offset)
    if limit is not None:
        ordered = ordered.limit(limit)
    return ordered.all(), total


def save_assignment(assignment: RecommendedTestAssignment, *, commit: bool = True):
    db.session.add(assignment)
    if commit:
        db.session.commit()
    return assignment
