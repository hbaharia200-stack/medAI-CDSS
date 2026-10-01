"""Public website contact messages (landing-page Contact form).

Deliberately kept separate from :mod:`app.services.message_service`, which is
the authenticated clinical/staff chat. A public visitor is not a staff member
and has no account, so their message lives in its own table and is surfaced to
staff under "Public Contact Messages" in the dashboard.

Only what the existing form collects is accepted: a name and a message. No
email, no phone, no clinical detail is requested or stored.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone

from app.extensions import db
from app.models import ContactMessage, UserRole
from app.utils import NotFoundError, ValidationError

#: Length limits. Bounded so a visitor cannot use the form to store arbitrary
#: volumes of data.
MAX_NAME = 120
MAX_MESSAGE = 4000

#: Workflow status values staff can set.
STATUSES = ("new", "read", "replied")

SOURCE = "website_contact_form"

#: Substrings that indicate an attempt to inject markup/script. The message is
#: stored and later rendered as text, never as HTML, so this is defence in depth
#: rather than the primary control.
_SCRIPT_RE = re.compile(
    r"(<\s*script|<\s*/\s*script|javascript\s*:|<\s*iframe|<\s*object|<\s*embed|onerror\s*=|onload\s*=|onclick\s*=)",
    re.IGNORECASE,
)


def _clean_text(value, field: str, maximum: int) -> str:
    """Trim, enforce a length ceiling and reject empty values."""
    if value is None or not isinstance(value, str):
        raise ValidationError(f"'{field}' is required.", "required_field_missing")
    cleaned = value.strip()
    if not cleaned:
        raise ValidationError(f"'{field}' is required.", "required_field_missing")
    if len(cleaned) > maximum:
        raise ValidationError(
            f"'{field}' must be at most {maximum} characters.",
            "field_too_long",
        )
    return cleaned


def submit_public_message(data: dict) -> dict:
    """Persist a contact-form submission. No authentication required."""
    name = _clean_text(data.get("name"), "name", MAX_NAME)
    message = _clean_text(data.get("message"), "message", MAX_MESSAGE)

    if _SCRIPT_RE.search(name) or _SCRIPT_RE.search(message):
        raise ValidationError(
            "Your message contains unsupported markup. Please send plain text.",
            "unsafe_content",
        )

    record = ContactMessage(name=name, message=message, source=SOURCE, status="new")
    db.session.add(record)
    db.session.commit()
    return record.to_dict()


def list_messages(actor, *, status: str | None = None, limit: int = 100) -> dict:
    """Staff read of the public inbox. Staff only (no patient access)."""
    role = actor.role.value if hasattr(actor.role, "value") else str(actor.role)
    if role == UserRole.patient.value:
        from app.utils import AuthError

        raise AuthError("forbidden_role", "Patients cannot view contact messages.", 403)

    if status is not None and status not in STATUSES:
        raise ValidationError(
            f"'status' must be one of: {', '.join(STATUSES)}.", "invalid_status"
        )

    query = db.session.query(ContactMessage)
    if status:
        query = query.filter(ContactMessage.status == status)
    total = query.count()
    rows = (
        query.order_by(ContactMessage.created_at.desc())
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return {"items": [r.to_dict() for r in rows], "total": total}


def get_message(actor, message_id: str) -> dict:
    """A single message. Staff only."""
    role = actor.role.value if hasattr(actor.role, "value") else str(actor.role)
    if role == UserRole.patient.value:
        from app.utils import AuthError

        raise AuthError("forbidden_role", "Patients cannot view contact messages.", 403)

    record = db.session.get(ContactMessage, message_id)
    if record is None:
        raise NotFoundError("Contact message not found.")
    return record.to_dict()


def set_status(actor, message_id: str, status: str) -> dict:
    """Advance new -> read -> replied. Staff only."""
    role = actor.role.value if hasattr(actor.role, "value") else str(actor.role)
    if role == UserRole.patient.value:
        from app.utils import AuthError

        raise AuthError("forbidden_role", "Patients cannot update contact messages.", 403)

    if status not in STATUSES:
        raise ValidationError(
            f"'status' must be one of: {', '.join(STATUSES)}.", "invalid_status"
        )
    record = db.session.get(ContactMessage, message_id)
    if record is None:
        raise NotFoundError("Contact message not found.")

    record.status = status
    if status != "new" and record.read_at is None:
        record.read_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.commit()
    return record.to_dict()