"""Patient-safe MedAI Agent transport.

POST /api/agent/chat            patient — send a message (model still pending)
GET  /api/agent/history         patient — this patient's own transcript
POST /api/agent/attachments     patient — upload a real file (multipart)
GET  /api/agent/attachments/<id> patient/staff — download that file
"""
from __future__ import annotations

from flask import Blueprint, request, send_file
from flask_jwt_extended import current_user
from io import BytesIO

from app.api._helpers import int_arg, json_body, role_guard
from app.services import agent_service
from app.utils import ValidationError, ok

bp = Blueprint("agent", __name__, url_prefix="/api/agent")


@bp.route("/chat", methods=["POST"])
@role_guard("patient")
def chat():
    data = json_body()
    message = str(data.get("message") or "").strip()
    attachment_id = data.get("attachmentId") or data.get("attachment_id") or None
    # A message may legitimately be *only* an attachment (a photo or a voice
    # note), so "message" is required only when nothing was attached.
    if not message and not attachment_id:
        raise ValidationError(
            "'message' is required unless an 'attachmentId' is provided.",
            "required_field_missing",
        )
    # The app language travels with every request: AI-generated prose cannot be
    # localized by front-end translation keys, so the provider prompt has to
    # know which language to answer in. Unknown tags fall back to English.
    language = data.get("language") or data.get("locale") or data.get("lang")
    response = agent_service.respond(
        actor=current_user,
        message=message,
        case_id=data.get("caseId") or data.get("case_id"),
        attachment_id=attachment_id,
        language=str(language) if language else None,
    )
    return ok(response)


@bp.route("/history", methods=["GET"])
@role_guard("patient")
def history():
    return ok(agent_service.history(current_user, limit=int_arg("limit", 200, 1, 500)))


@bp.route("/feedback", methods=["POST"])
@role_guard("patient")
def submit_feedback():
    """Record the patient's own 1-5 rating of the service they received."""
    data = json_body()
    language = data.get("language") or data.get("locale")
    return ok(
        agent_service.record_service_rating(
            actor=current_user,
            rating=data.get("rating"),
            case_id=data.get("caseId") or data.get("case_id"),
            language=str(language) if language else None,
            comment=data.get("comment"),
        ),
        201,
    )


@bp.route("/feedback", methods=["GET"])
@role_guard("patient")
def feedback_summary():
    return ok(agent_service.ratings_summary(current_user))


@bp.route("/attachments", methods=["POST"])
@role_guard("patient")
def upload_attachment():
    storage = request.files.get("file")
    if storage is None:
        raise ValidationError("A multipart 'file' field is required.", "missing_file")
    case_id = request.form.get("caseId") or request.form.get("case_id") or None
    return ok(agent_service.create_attachment(
        actor=current_user, storage=storage, case_id=case_id
    ), 201)


@bp.route("/attachments/<attachment_id>", methods=["GET"])
@role_guard("patient", "nurse", "doctor", "admin")
def download_attachment(attachment_id: str):
    attachment = agent_service.get_attachment(current_user, attachment_id)
    if attachment.data is None:
        raise ValidationError("This attachment has no stored content.", "attachment_content_missing")
    return send_file(
        BytesIO(attachment.data),
        mimetype=attachment.content_type,
        as_attachment=False,
        download_name=attachment.filename,
    )
