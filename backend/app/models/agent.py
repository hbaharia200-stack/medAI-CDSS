"""Patient MedAI-Agent persistence.

Two concerns live here, both owned by the *backend* so a patient's transcript
and files survive app restarts, sign-out/sign-in and device changes:

* ``AgentMessage``  — the patient's chat transcript, keyed to the patient (and
  optionally the case it was asked about). This is UI-free: the clinical model
  is still unavailable, so the assistant rows simply record the honest
  "model unavailable" state that was actually served.
* ``AgentAttachment`` — a real file (image / PDF / text / audio) uploaded by the
  patient and owned by their case. The bytes are stored so the message can own
  the file. Nothing here claims the file was analysed.
"""
from __future__ import annotations

from datetime import datetime

from app.extensions import db
from app.utils import gen_uuid

# Hard ceiling enforced by the API layer before anything is written.
MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024  # 8 MiB

# Clinically reasonable uploads. Executables and archives are refused outright.
ALLOWED_CONTENT_TYPES = frozenset(
    {
        # images
        "image/jpeg",
        "image/png",
        "image/webp",
        # documents
        "application/pdf",
        "text/plain",
        # recorded voice notes
        "audio/webm",
        "audio/ogg",
        "audio/mp4",
        "audio/mpeg",
        "audio/wav",
        "audio/x-m4a",
        "audio/aac",
    }
)


class AgentAttachment(db.Model):
    __tablename__ = "agent_attachments"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    # Owner. Kept denormalised (and FK'd) so authorization never depends on a
    # second lookup through the case.
    patient_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=True, index=True)
    uploaded_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)

    # Client-supplied name is only ever used for display; never for a path.
    filename = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(128), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False, default=0)
    # "file" for picked documents/images, "audio" for a recorded voice note.
    kind = db.Column(db.String(16), nullable=False, default="file")
    data = db.Column(db.LargeBinary, nullable=True)
    # Python-side timestamp (microsecond resolution). db.func.now() is only
    # second-resolution on SQLite, which makes a patient's question and its
    # answer share a timestamp and lets the transcript read out of order.
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class AgentMessage(db.Model):
    __tablename__ = "agent_messages"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    # The transcript belongs to the *account*, not the device, so Patient A
    # never sees Patient B's history.
    patient_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=True, index=True)
    # "patient" or "assistant".
    role = db.Column(db.String(16), nullable=False)
    text = db.Column(db.Text, nullable=True)
    attachment_id = db.Column(
        db.String(36), db.ForeignKey("agent_attachments.id"), nullable=True, index=True
    )
    # Microsecond resolution for the same reason as AgentAttachment.created_at:
    # a question and its answer are written in the same request and must keep
    # their causal order when the transcript is read back.
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class AgentServiceRating(db.Model):
    """A patient's rating of the service they received from the patient agent.

    Deliberately separate from ``FeedbackRecord``, which records a *doctor's*
    clinical judgement on an AI recommendation. This one is a patient-experience
    signal about the agent journey itself, so the two can never be confused.

    Nothing is ever written here implicitly: a row exists only because the
    patient actually tapped a rating.
    """

    __tablename__ = "agent_service_ratings"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    patient_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    # The case the rating relates to, when the patient was talking about one.
    case_id = db.Column(db.String(36), db.ForeignKey("patient_cases.id"), nullable=True, index=True)
    # Integer 1-5. Stored as an integer so it can be averaged in reports.
    rating = db.Column(db.Integer, nullable=False)
    # Language the patient was reading when they rated.
    language = db.Column(db.String(8), nullable=True)
    # Optional free text. Bounded and never rendered as clinical data.
    comment = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
