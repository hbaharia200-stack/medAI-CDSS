"""Public contact messages (landing-page Contact form).

Naming follows the existing resource convention (``/api/<resource>``):

POST  /api/contact-messages          public  — submit a website enquiry
GET   /api/contact-messages          staff   — the public inbox
GET   /api/contact-messages/<id>     staff   — one message
PATCH /api/contact-messages/<id>     staff   — new -> read -> replied

These are intentionally NOT part of ``/api/messages`` (the clinical staff chat):
a public visitor message must never appear inside a staff conversation.
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user

from app.api._helpers import int_arg, json_body, role_guard, str_arg
from app.services import contact_service
from app.utils import ok

bp = Blueprint("contact_messages", __name__, url_prefix="/api/contact-messages")

#: Staff who may read the public inbox. Patients are excluded by the service
#: too, so the rule holds even if a route is added elsewhere later.
STAFF = ("doctor", "nurse", "admin")


@bp.route("", methods=["POST"])
def submit_message():
    """Public submission — no authentication (the visitor has no account)."""
    return ok(contact_service.submit_public_message(json_body()), 201)


@bp.route("", methods=["GET"])
@role_guard(*STAFF)
def list_messages():
    result = contact_service.list_messages(
        current_user,
        status=str_arg("status"),
        limit=int_arg("limit", 100, minimum=1, maximum=500),
    )
    return ok(result["items"], 200, total=result["total"])


@bp.route("/<message_id>", methods=["GET"])
@role_guard(*STAFF)
def get_message(message_id: str):
    return ok(contact_service.get_message(current_user, message_id))


@bp.route("/<message_id>", methods=["PATCH"])
@role_guard(*STAFF)
def update_message(message_id: str):
    return ok(contact_service.set_status(current_user, message_id, json_body().get("status")))