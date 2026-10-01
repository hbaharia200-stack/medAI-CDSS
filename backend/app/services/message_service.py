"""Staff messaging (chat rooms, messages, attachments).

Deliberately a clean REST foundation: no WebSocket/real-time layer is
introduced, so the mobile/web clients poll these endpoints. Access is
restricted to room participants (admins may read any room).

Public website contact messages are NOT handled here: they live in
``contact_service`` / ``ContactMessage`` so an unauthenticated visitor is
never mixed into a clinical staff conversation.
"""
from __future__ import annotations

from app.extensions import db
from app.models import ChatRoomParticipant, UserRole
from app.repositories import log_audit
from app.repositories import workflow_repo as repo
from app.schemas.workflow import serialize_message, serialize_room
from app.utils import AuthError, NotFoundError, ValidationError

def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


def _is_participant(room_id: str, user_id: str) -> bool:
    return (
        db.session.query(ChatRoomParticipant)
        .filter_by(room_id=room_id, user_id=user_id)
        .first()
        is not None
    )


def _require_room_access(room_id: str, actor) -> None:
    room = repo.get_room(room_id)
    if room is None:
        raise NotFoundError("Chat room not found.")
    if _role(actor) == UserRole.admin.value:
        return
    if not _is_participant(room_id, actor.id):
        raise AuthError("forbidden_room", "You are not a participant in this room.", 403)


def list_rooms(actor) -> list[dict]:
    if _role(actor) == UserRole.admin.value:
        from app.models import ChatRoom

        rooms = db.session.query(ChatRoom).order_by(ChatRoom.created_at.desc()).all()
    else:
        rooms = repo.list_rooms_for_user(actor.id)
    return [serialize_room(r) for r in rooms]


def create_room(actor, data: dict) -> dict:
    """Create a room. ``participantIds`` defaults to the creator (self-chat/notes)."""
    name = (data.get("name") or "").strip() or None
    is_group = bool(data.get("isGroup", False))
    requested = data.get("participantIds") or []
    if not isinstance(requested, list):
        raise ValidationError("'participantIds' must be a list of user ids.", "invalid_participants")

    from app.models import User

    participant_ids: list[str] = []
    for uid in requested:
        user = db.session.get(User, uid)
        if user is None:
            raise ValidationError(f"Unknown participant: {uid}", "invalid_participants")
        if user.id not in participant_ids:
            participant_ids.append(user.id)
    if actor.id not in participant_ids:
        participant_ids.append(actor.id)

    room = repo.create_room(name, participant_ids, is_group, created_by=actor.id)
    db.session.commit()
    log_audit(
        action="chat.room_created",
        user_id=actor.id,
        role=_role(actor),
        detail={"roomId": room.id, "participants": len(participant_ids)},
    )
    return serialize_room(room)


def list_messages(actor, room_id: str, limit: int = 100) -> list[dict]:
    _require_room_access(room_id, actor)
    return [serialize_message(m) for m in repo.list_messages(room_id, limit=limit)]


def send_message(actor, data: dict) -> dict:
    room_id = (data.get("roomId") or data.get("room_id") or "").strip()
    if not room_id:
        raise ValidationError("'roomId' is required.", "required_field_missing")
    _require_room_access(room_id, actor)

    body = data.get("body")
    body = body.strip() if isinstance(body, str) else None
    attachments = data.get("attachments") or []
    if not body and not (isinstance(attachments, list) and attachments):
        raise ValidationError("A message needs a 'body' or at least one attachment.", "empty_message")
    if not isinstance(attachments, list):
        raise ValidationError("'attachments' must be a list.", "invalid_attachments")
    for att in attachments:
        if not isinstance(att, dict) or not att.get("filename"):
            raise ValidationError("Each attachment needs a 'filename'.", "invalid_attachments")

    message = repo.send_message(room_id, actor.id, body, attachments)
    db.session.commit()
    return serialize_message(message)


def mark_room_read(actor, room_id: str) -> dict:
    from datetime import datetime, timezone

    from app.models import Message

    _require_room_access(room_id, actor)
    db.session.query(Message).filter(
        Message.room_id == room_id,
        Message.sender_id != actor.id,
        Message.read == False,  # noqa: E712 - SQLAlchemy needs the literal False
    ).update({"read": True}, synchronize_session=False)

    participant = (
        db.session.query(ChatRoomParticipant)
        .filter_by(room_id=room_id, user_id=actor.id)
        .first()
    )
    if participant is not None:
        participant.last_read_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.commit()
    return {"roomId": room_id, "markedRead": int(True)}
