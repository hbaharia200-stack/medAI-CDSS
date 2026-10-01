"""Messaging API — REST foundation (no real-time layer).

GET  /api/chat-rooms                auth — rooms the user participates in
POST /api/chat-rooms                auth — create a room
POST /api/chat-rooms/<id>/read      auth — mark the room read
GET  /api/messages?roomId=...       auth — messages in a room (participants only)
POST /api/messages                  auth — send a message (+attachments metadata)
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user, jwt_required

from app.api._helpers import int_arg, json_body, str_arg
from app.services import message_service
from app.utils import ok

bp = Blueprint("messages", __name__, url_prefix="/api")  # top-level /api/messages + /api/chat-rooms


@bp.route("/chat-rooms", methods=["GET"])
@jwt_required()
def list_rooms():
    return ok(message_service.list_rooms(current_user))


@bp.route("/chat-rooms", methods=["POST"])
@jwt_required()
def create_room():
    return ok(message_service.create_room(current_user, json_body()), 201)


@bp.route("/chat-rooms/<room_id>/read", methods=["POST"])
@jwt_required()
def mark_read(room_id: str):
    return ok(message_service.mark_room_read(current_user, room_id))


@bp.route("/messages", methods=["GET"])
@jwt_required()
def list_messages():
    room_id = str_arg("roomId") or str_arg("room_id")
    if not room_id:
        from app.utils import ValidationError

        raise ValidationError("'roomId' is required.", "required_query_param")
    return ok(message_service.list_messages(current_user, room_id, limit=int_arg("limit", 100)))


@bp.route("/messages", methods=["POST"])
@jwt_required()
def send_message():
    return ok(message_service.send_message(current_user, json_body()), 201)

