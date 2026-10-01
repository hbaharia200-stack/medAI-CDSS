"""Domain models for the MedAI backend.

All models use the SQLAlchemy 2.0 declarative style and the shared ``db``
instance from ``app.extensions``. Enums use ``native_enum=False`` so the same
schema runs on both PostgreSQL (production) and SQLite (local/tests).
"""
from __future__ import annotations

import enum

from app.extensions import db
from app.utils import gen_uuid

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class UserRole(str, enum.Enum):
    patient = "patient"
    nurse = "nurse"
    doctor = "doctor"
    admin = "admin"

    @classmethod
    def values(cls):
        return {r.value for r in cls}


class CaseStatus(str, enum.Enum):
    submitted = "submitted"
    ai_assessed = "ai_assessed"
    doctor_reviewing = "doctor_reviewing"
    sent_to_nurse = "sent_to_nurse"
    tests_in_progress = "tests_in_progress"
    tests_completed = "tests_completed"
    doctor_final_review = "doctor_final_review"
    treatment = "treatment"
    doctor_unavailable = "doctor_unavailable"
    appointment_required = "appointment_required"
    follow_up = "follow_up"
    # Legacy values remain readable for existing database rows.
    intake_pending = "intake_pending"
    vitals_pending = "vitals_pending"
    awaiting_review = "awaiting_review"
    in_review = "in_review"
    completed = "completed"


class AssignmentStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    acknowledged = "acknowledged"
    completed = "completed"


class AppointmentStatus(str, enum.Enum):
    """Appointment lifecycle.

    ``pending`` / ``confirmed`` / ``completed`` / ``cancelled`` are the public
    booking states used by the website form and the doctor appointment
    dashboard. ``scheduled`` (staff-created) and ``no_show`` are kept for
    backward compatibility with existing rows/code paths.
    """

    pending = "pending"
    confirmed = "confirmed"
    scheduled = "scheduled"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    unpaid = "unpaid"
    paid = "paid"
    overdue = "overdue"


# Re-export models for convenience
from .agent import (
    ALLOWED_CONTENT_TYPES,
    MAX_ATTACHMENT_BYTES,
    AgentAttachment,
    AgentMessage,
    AgentServiceRating,
)
from .audit import AuditLog, FeedbackRecord
from .billing import Invoice, InvoiceLine, Payment
from .case import PatientCase
from .clinical import (
    Diagnosis,
    MedicalHistory,
    Symptom,
    Vital,
)
from .messaging import Attachment, ChatRoom, ChatRoomParticipant, ContactMessage, Message
from .recommendation import (
    AIRecommendation,
    RecommendedTest,
    RecommendedTestAssignment,
)
from .user import (
    DoctorProfile,
    NurseProfile,
    PatientProfile,
    TokenBlocklist,
    User,
)
from .workflow import Appointment

__all__ = [
    "UserRole", "CaseStatus", "AssignmentStatus", "AppointmentStatus", "InvoiceStatus",
    "db", "gen_uuid",
    "User", "PatientProfile", "DoctorProfile", "NurseProfile", "TokenBlocklist",
    "PatientCase", "Symptom", "Vital", "MedicalHistory", "Diagnosis",
    "AIRecommendation", "RecommendedTest", "RecommendedTestAssignment",
    "ChatRoom", "ChatRoomParticipant", "Message", "Attachment", "ContactMessage",
    "AgentMessage", "AgentAttachment", "AgentServiceRating",
    "MAX_ATTACHMENT_BYTES", "ALLOWED_CONTENT_TYPES",
    "Invoice", "InvoiceLine", "Payment", "Appointment", "AuditLog", "FeedbackRecord",
]
