"""Serialization for appointments, invoices, and messages."""
from __future__ import annotations

from . import _dt


def serialize_appointment(a) -> dict:
    return {
        "id": a.id,
        "uuid": getattr(a, "uuid", a.id),
        "patientId": a.patient_id,
        "doctorId": a.doctor_id,
        "title": a.title,
        "description": a.description,
        "startTime": _dt(a.start_time),
        "endTime": _dt(a.end_time),
        "fees": float(a.fees) if a.fees is not None else None,
        "status": a.status.value if hasattr(a.status, "value") else a.status,
        "createdAt": _dt(getattr(a, "created_at", None)),
    }


def serialize_invoice(inv) -> dict:
    return {
        "id": inv.id,
        "uuid": getattr(inv, "uuid", inv.id),
        "patientId": inv.patient_id,
        "appointmentId": inv.appointment_id,
        "number": inv.number,
        "currency": inv.currency,
        "totalAmount": float(inv.total_amount) if inv.total_amount is not None else 0.0,
        "status": inv.status.value if hasattr(inv.status, "value") else inv.status,
        "issuedAt": _dt(inv.issued_at),
        "dueDate": _dt(inv.due_date),
        "paidAt": _dt(inv.paid_at),
        "lines": [
            {"description": l.description, "amount": float(l.amount), "quantity": l.quantity}
            for l in (inv.lines or [])
        ],
    }


def serialize_message(m) -> dict:
    return {
        "id": m.id,
        "roomId": m.room_id,
        "senderId": m.sender_id,
        "body": m.body,
        "createdAt": _dt(m.created_at),
        "read": m.read,
        "attachments": [
            {"id": a.id, "filename": a.filename, "contentType": a.content_type, "sizeBytes": a.size_bytes}
            for a in (m.attachments or [])
        ],
    }


def serialize_room(room) -> dict:
    return {
        "id": room.id,
        "name": room.name,
        "isGroup": room.is_group,
        "createdAt": _dt(getattr(room, "created_at", None)),
        "createdBy": getattr(room, "created_by", None),
        "participantIds": [p.user_id for p in (room.participants or [])],
    }


# ---------------------------------------------------------------------------
# Appointment detail (Public booking form -> Doctor appointment dashboard)
# ---------------------------------------------------------------------------


def serialize_appointment_detail(a) -> dict:
    """Appointment plus the patient/doctor contact details the dashboard needs.

    Includes the local ``date`` (YYYY-MM-DD) and ``time`` (HH:MM) fields so the
    existing appointment dashboard can render the booking form's values without
    parsing timestamps client-side.
    """
    start = getattr(a, "start_time", None)
    patient = getattr(a, "patient", None)
    doctor = getattr(a, "doctor", None)
    return {
        "id": a.id,
        "uuid": getattr(a, "uuid", a.id),
        "patientId": a.patient_id,
        "patientName": patient.full_name if patient else None,
        "patientPhone": patient.phone if patient else None,
        "patientEmail": patient.email if patient else None,
        "doctorId": a.doctor_id,
        "doctorName": doctor.full_name if doctor else None,
        "doctorSpecialization": (
            getattr(getattr(doctor, "doctor_profile", None), "specialization", None) if doctor else None
        ),
        "doctorLabel": a.title,
        "title": a.title,
        "reason": a.description,
        "description": a.description,
        "date": start.date().isoformat() if start else None,
        "time": start.strftime("%H:%M") if start else None,
        "startTime": _dt(start),
        "endTime": _dt(getattr(a, "end_time", None)),
        "fees": float(a.fees) if a.fees is not None else None,
        "status": a.status.value if hasattr(a.status, "value") else a.status,
        "createdAt": _dt(getattr(a, "created_at", None)),
    }


def serialize_staff_member(user, specialization: str | None = None) -> dict:
    """Doctor/nurse directory entry (public ``GET /api/doctors`` + admin lists)."""
    return {
        "id": user.id,
        "staffId": user.staff_id,
        "fullName": user.full_name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "specialization": specialization,
        "phone": user.phone,
        "email": user.email,
        "picture": getattr(getattr(user, "doctor_profile", None), "picture", None),
    }
