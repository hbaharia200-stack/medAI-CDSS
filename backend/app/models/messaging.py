"""Messaging: staff chat rooms, messages, attachments."""
from __future__ import annotations

from app.extensions import db
from app.utils import gen_uuid


class ContactMessage(db.Model):
    """A message submitted by an anonymous visitor via the public website.

    Deliberately SEPARATE from :class:`Message` (staff chat rooms):

    * ``Message`` is authenticated clinical/staff communication between named
      staff accounts and carries room membership + read receipts.
    * ``ContactMessage`` has no author account (the visitor is not signed up),
      no clinical context, and is read by staff in the dashboard's
      "Public Contact Messages" list.

    Keeping them in different tables is what stops an unauthenticated public
    sender ever being mixed into a clinical conversation.
    """

    __tablename__ = "contact_messages"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)

    #: Free-text name the visitor typed. Not an account, not an email.
    name = db.Column(db.String(120), nullable=False)
    message = db.Column(db.Text, nullable=False)
    #: Where it came from, so staff can tell a website enquiry from anything a
    #: future channel might add. Always "website_contact_form" today.
    source = db.Column(db.String(64), nullable=False, default="website_contact_form")
    #: new -> read -> replied, advanced by staff via PATCH.
    status = db.Column(db.String(16), nullable=False, default="new", index=True)
    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False, index=True)
    read_at = db.Column(db.DateTime, nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "message": self.message,
            "source": self.source,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "readAt": self.read_at.isoformat() if self.read_at else None,
        }


class ChatRoom(db.Model):
    __tablename__ = "chat_rooms"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    name = db.Column(db.String(128), nullable=True)
    is_group = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    created_by = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)

    participants = db.relationship("ChatRoomParticipant", back_populates="room", cascade="all, delete-orphan")
    messages = db.relationship("Message", back_populates="room", cascade="all, delete-orphan")


class ChatRoomParticipant(db.Model):
    __tablename__ = "chat_room_participants"

    room_id = db.Column(db.String(36), db.ForeignKey("chat_rooms.id"), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), primary_key=True)
    joined_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    last_read_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)

    room = db.relationship("ChatRoom", back_populates="participants")


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    room_id = db.Column(db.String(36), db.ForeignKey("chat_rooms.id"), nullable=False, index=True)
    sender_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    body = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    read = db.Column(db.Boolean, nullable=False, default=False)

    attachments = db.relationship("Attachment", back_populates="message", cascade="all, delete-orphan")

    room = db.relationship("ChatRoom", back_populates="messages")


class Attachment(db.Model):
    __tablename__ = "attachments"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    message_id = db.Column(db.String(36), db.ForeignKey("messages.id"), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(128), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False, default=0)
    data = db.Column(db.LargeBinary, nullable=True)  # small files; large ones use external storage

    message = db.relationship("Message", back_populates="attachments")
