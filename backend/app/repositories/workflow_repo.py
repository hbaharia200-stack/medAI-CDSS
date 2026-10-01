"""Repositories for appointments, invoices, and staff messaging."""
from __future__ import annotations

from datetime import datetime

from app.extensions import db
from app.models import (
    Appointment,
    AppointmentStatus,
    Attachment,
    ChatRoom,
    ChatRoomParticipant,
    Invoice,
    InvoiceLine,
    InvoiceStatus,
    Message,
)
from app.models import AppointmentStatus as AStatus  # noqa: E402  (convenience alias)


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------


def get_appointment(aid: str) -> Appointment | None:
    return db.session.get(Appointment, aid)


def list_appointments(for_user: str | None = None, upcoming: bool | None = None) -> list[Appointment]:
    q = db.session.query(Appointment)
    if for_user is not None:
        q = q.filter((Appointment.patient_id == for_user) | (Appointment.doctor_id == for_user))
    now = datetime.utcnow()
    if upcoming is True:
        q = q.filter(Appointment.start_time >= now, Appointment.status == AppointmentStatus.scheduled)
    if upcoming is False:
        q = q.filter(Appointment.start_time < now)
    return q.order_by(Appointment.start_time.desc()).all()


def create_appointment(
    patient_id: str,
    doctor_id: str | None,
    title: str,
    start_time: datetime,
    end_time: datetime | None,
    description: str | None,
    fees: float | None,
) -> Appointment:
    appt = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        title=title,
        description=description,
        start_time=start_time,
        end_time=end_time,
        fees=fees,
        status=AppointmentStatus.scheduled,
    )
    db.session.add(appt)
    db.session.flush()
    return appt


def update_appointment(appt: Appointment, **fields) -> Appointment:
    for k, v in fields.items():
        if v is not None:
            setattr(appt, k, v)
    db.session.add(appt)
    db.session.commit()
    return appt


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------


def get_invoice(iid: str) -> Invoice | None:
    return db.session.get(Invoice, iid)


def list_invoices(for_patient: str | None = None) -> list[Invoice]:
    q = db.session.query(Invoice)
    if for_patient is not None:
        q = q.filter_by(patient_id=for_patient)
    return q.order_by(Invoice.issued_at.desc()).all()


def next_invoice_number() -> str:
    count = db.session.query(Invoice).count()
    return f"INV-{2024 + count}-{1000 + count}"


def create_invoice(
    patient_id: str,
    lines: list[dict],
    appointment_id: str | None = None,
    currency: str = "TZS",
    due_date: datetime | None = None,
) -> Invoice:
    inv = Invoice(
        patient_id=patient_id,
        appointment_id=appointment_id,
        number=next_invoice_number(),
        currency=currency,
        due_date=due_date,
    )
    total = 0.0
    for line in lines:
        amt = float(line["amount"])
        qty = int(line.get("quantity", 1))
        total += amt * qty
        inv.lines.append(
            InvoiceLine(description=line["description"], amount=amt, quantity=qty)
        )
    inv.total_amount = total  # type: ignore[assignment]
    db.session.add(inv)
    db.session.flush()
    return inv


def update_invoice(inv: Invoice, **fields) -> Invoice:
    for k, v in fields.items():
        if v is not None:
            setattr(inv, k, v)
    db.session.add(inv)
    db.session.commit()
    return inv


# ---------------------------------------------------------------------------
# Messaging
# ---------------------------------------------------------------------------


def get_room(room_id: str) -> ChatRoom | None:
    return db.session.get(ChatRoom, room_id)


def list_rooms_for_user(user_id: str) -> list[ChatRoom]:
    return (
        db.session.query(ChatRoom)
        .join(ChatRoomParticipant)
        .filter(ChatRoomParticipant.user_id == user_id)
        .order_by(ChatRoom.created_at.desc())
        .all()
    )


def create_room(name: str | None, participant_ids: list[str], is_group: bool = False, created_by: str | None = None) -> ChatRoom:
    room = ChatRoom(name=name, is_group=is_group, created_by=created_by)
    db.session.add(room)
    db.session.flush()
    for uid in participant_ids:
        db.session.add(ChatRoomParticipant(room_id=room.id, user_id=uid))
    db.session.flush()
    return room


def list_messages(room_id: str, limit: int = 100) -> list[Message]:
    return (
        db.session.query(Message)
        .filter_by(room_id=room_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
        .all()
    )


def send_message(room_id: str, sender_id: str, body: str | None, attachments: list[dict] | None = None) -> Message:
    msg = Message(room_id=room_id, sender_id=sender_id, body=body)
    db.session.add(msg)
    db.session.flush()
    for att in attachments or []:
        db.session.add(
            Attachment(
                message_id=msg.id,
                filename=att["filename"],
                content_type=att.get("contentType", "application/octet-stream"),
                size_bytes=att.get("sizeBytes", 0),
                data=att.get("data"),
            )
        )
    db.session.flush()
    return msg
