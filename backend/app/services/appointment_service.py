"""Appointment booking + doctor appointment-dashboard queries.

The public landing-page form books without an account: we resolve (or create) a
patient *record* and store a real row in PostgreSQL. Patients created this way
have no password (a clinical record, not an account) — staff can attach
credentials later via ``POST /api/patients/<id>/credentials``.
"""
from __future__ import annotations

import datetime

from flask import current_app

from app.extensions import db
from app.models import AppointmentStatus, User, UserRole
from app.repositories import appointment_repo, log_audit, patient_repo
from app.schemas.workflow import serialize_appointment_detail
from app.utils import AuthError, ConflictError, NotFoundError, ValidationError, is_valid_email
from app.utils.validation import parse_date, parse_time

DEFAULT_DURATION_MINUTES = 30
PATIENT_STATUSES = {"cancelled"}


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


def _cfg(key: str, default=None):
    try:
        return current_app.config.get(key, default)
    except RuntimeError:
        return default


def _record_or_404(appointment_id: str):
    appointment = appointment_repo.get_appointment(appointment_id)
    if appointment is None:
        raise NotFoundError("Appointment not found.")
    return appointment


def can_access(actor, appointment) -> bool:
    role = _role(actor)
    if role == UserRole.admin.value:
        return True
    if role == UserRole.patient.value:
        return appointment.patient_id == actor.id
    if role == UserRole.doctor.value:
        return appointment.doctor_id == actor.id or appointment.doctor_id is None
    # Nurses/front-desk staff manage the schedule.
    return role == UserRole.nurse.value


def require_access(actor, appointment) -> None:
    if not can_access(actor, appointment):
        raise AuthError("forbidden_appointment", "You do not have access to this appointment.", 403)


# ---------------------------------------------------------------------------
# Public booking
# ---------------------------------------------------------------------------


def _validate_booking(data: dict) -> dict:
    patient_name = str(data.get("patientName") or data.get("fullName") or data.get("name") or "").strip()
    phone = str(data.get("phone") or "").strip()
    email = str(data.get("email") or "").strip() or None
    doctor_label = str(data.get("doctor") or data.get("doctorId") or "").strip() or None
    reason = str(data.get("reason") or data.get("description") or "").strip() or None

    if not patient_name:
        raise ValidationError("'patientName' is required.", "required_field_missing")
    if not phone:
        raise ValidationError("'phone' is required.", "required_field_missing")
    if email and not is_valid_email(email):
        raise ValidationError("'email' must be a valid email address.", "invalid_email")

    preferred_date = parse_date(
        data.get("preferredDate") or data.get("date"), "preferredDate"
    )
    preferred_time = parse_time(
        data.get("preferredTime") or data.get("time"), "preferredTime"
    )

    max_days = int(_cfg("APPOINTMENT_MAX_DAYS_AHEAD", 180) or 180)
    today = datetime.date.today()
    if preferred_date < today:
        raise ValidationError("'preferredDate' cannot be in the past.", "invalid_date")
    if preferred_date > today + datetime.timedelta(days=max_days):
        raise ValidationError(
            f"'preferredDate' must be within {max_days} days from today.", "invalid_date"
        )

    return {
        "patientName": patient_name,
        "phone": phone,
        "email": email,
        "doctorLabel": doctor_label,
        "reason": reason,
        "date": preferred_date,
        "time": preferred_time,
        "startTime": datetime.datetime.combine(preferred_date, preferred_time),
    }


def _resolve_patient(booking: dict) -> User:
    """Find the patient record by phone/email, or create a booking record."""
    patient = patient_repo.find_patient_by_phone(booking["phone"])
    if patient is None and booking["email"]:
        patient = patient_repo.find_patient_by_email(booking["email"])
    if patient is not None:
        # Keep the record tidy without touching clinical data.
        if not patient.email and booking["email"]:
            patient.email = booking["email"]
        if not patient.full_name and booking["patientName"]:
            patient.full_name = booking["patientName"]
        db.session.flush()
        return patient

    return patient_repo.create_patient_record(
        full_name=booking["patientName"],
        phone=booking["phone"],
        email=booking["email"],
        password_hash=None,  # booking record — no login credentials
    )


def book_from_public_form(data: dict) -> dict:
    """Create an appointment from the public booking form (no auth required)."""
    booking = _validate_booking(data)

    doctor = None
    if booking["doctorLabel"]:
        doctor = patient_repo.find_doctor_by_label(booking["doctorLabel"])

    patient = _resolve_patient(booking)

    if doctor is not None and appointment_repo.has_conflict(doctor.id, booking["startTime"]):
        raise ConflictError(
            "That doctor already has an appointment at the requested time. Please pick another slot.",
            "slot_taken",
        )

    appointment = appointment_repo.create_appointment(
        patient_id=patient.id,
        doctor_id=doctor.id if doctor else None,
        title=booking["doctorLabel"] or "General consultation",
        start_time=booking["startTime"],
        end_time=booking["startTime"] + datetime.timedelta(minutes=DEFAULT_DURATION_MINUTES),
        description=booking["reason"],
        fees=_cfg("APPOINTMENT_DEFAULT_FEES", 0) or 0,
        status=AppointmentStatus.pending.value,
    )
    db.session.commit()

    log_audit(
        action="appointment.booked",
        user_id=None,  # public booking — no authenticated actor
        role="public",
        detail={
            "appointmentId": appointment.id,
            "patientId": patient.id,
            "doctorId": appointment.doctor_id,
            "date": booking["date"].isoformat(),
            "time": booking["time"].strftime("%H:%M"),
            "doctorResolved": doctor is not None,
        },
    )

    payload = serialize_appointment_detail(appointment)
    payload["doctorResolved"] = doctor is not None
    return payload


# ---------------------------------------------------------------------------
# Dashboard reads
# ---------------------------------------------------------------------------


def list_appointments(
    actor,
    *,
    doctor_id: str | None = None,
    patient_id: str | None = None,
    status: str | None = None,
    day: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    order: str = "asc",
    limit: int | None = None,
    offset: int = 0,
) -> dict:
    role = _role(actor)
    # A doctor sees their own book *plus* bookings that nobody has claimed yet.
    # Without the unassigned part, a public booking made without choosing a
    # doctor (doctor_id IS NULL) is persisted but invisible to every clinician,
    # so nobody could ever confirm or act on it. This mirrors the existing
    # "nurse pool" rule used for recommended-test assignments.
    include_unassigned = False
    if role == UserRole.doctor.value:
        include_unassigned = doctor_id is None
        doctor_id = actor.id
    elif role == UserRole.patient.value:
        patient_id = actor.id

    if status:
        valid = {s.value for s in AppointmentStatus}
        if status not in valid:
            raise ValidationError(
                f"'status' must be one of: {', '.join(sorted(valid))}.", "invalid_status"
            )

    parsed_day = parse_date(day, "date") if day else None
    parsed_from = parse_date(date_from, "from") if date_from else None
    parsed_to = parse_date(date_to, "to") if date_to else None
    if parsed_from and parsed_to and parsed_from > parsed_to:
        raise ValidationError("'from' must be on or before 'to'.", "invalid_range")

    rows, total = appointment_repo.list_appointments(
        doctor_id=doctor_id,
        patient_id=patient_id,
        status=status,
        day=parsed_day,
        date_from=parsed_from,
        date_to=parsed_to,
        order=order,
        limit=limit,
        offset=offset,
        include_unassigned=include_unassigned,
    )
    return {"items": [serialize_appointment_detail(a) for a in rows], "total": total}


def get_appointment(appointment_id: str, actor) -> dict:
    appointment = _record_or_404(appointment_id)
    require_access(actor, appointment)
    return serialize_appointment_detail(appointment)


def update_appointment(appointment_id: str, data: dict, actor) -> dict:
    """Staff confirm/reschedule; patients may only cancel."""
    role = _role(actor)
    appointment = _record_or_404(appointment_id)
    require_access(actor, appointment)

    if data.get("status"):
        status = str(data["status"]).strip()
        if status not in {s.value for s in AppointmentStatus}:
            raise ValidationError(
                f"'status' must be one of: {', '.join(s.value for s in AppointmentStatus)}.",
                "invalid_status",
            )
        if role == UserRole.patient.value and status not in PATIENT_STATUSES:
            raise AuthError("forbidden_status", "Patients may only cancel an appointment.", 403)
        appointment.status = AppointmentStatus(status)

    if data.get("doctorId"):
        doctor = db.session.get(User, data["doctorId"])
        if doctor is None or doctor.role != UserRole.doctor:
            raise ValidationError("'doctorId' must reference a doctor.", "invalid_doctor")
        appointment.doctor_id = doctor.id

    if data.get("date") or data.get("preferredDate"):
        day = parse_date(data.get("date") or data.get("preferredDate"), "date")
        appointment.start_time = datetime.datetime.combine(day, appointment.start_time.time())
    if data.get("time") or data.get("preferredTime"):
        start = parse_time(data.get("time") or data.get("preferredTime"), "time")
        appointment.start_time = datetime.datetime.combine(appointment.start_time.date(), start)
    if appointment.end_time is not None:
        appointment.end_time = appointment.start_time + datetime.timedelta(
            minutes=DEFAULT_DURATION_MINUTES
        )

    if "reason" in data or "description" in data:
        appointment.description = data.get("reason") or data.get("description")

    if "fees" in data:
        appointment.fees = data.get("fees")

    appointment_repo.save(appointment)
    log_audit(
        action="appointment.updated",
        user_id=actor.id,
        role=role,
        detail={"appointmentId": appointment.id, "status": appointment.status.value},
    )
    return serialize_appointment_detail(appointment)


def confirm_appointment(appointment_id: str, actor) -> dict:
    appointment = _record_or_404(appointment_id)
    require_access(actor, appointment)
    role = _role(actor)
    if role == UserRole.patient.value:
        raise AuthError("forbidden_status", "Patients may not confirm appointments.", 403)
    appointment.status = AppointmentStatus.confirmed
    appointment_repo.save(appointment)
    log_audit(
        action="appointment.confirmed",
        user_id=actor.id,
        role=role,
        detail={"appointmentId": appointment.id},
    )
    return serialize_appointment_detail(appointment)


def cancel_appointment(appointment_id: str, actor) -> dict:
    appointment = _record_or_404(appointment_id)
    require_access(actor, appointment)
    appointment.status = AppointmentStatus.cancelled
    appointment_repo.save(appointment)
    log_audit(
        action="appointment.cancelled",
        user_id=actor.id,
        role=_role(actor),
        detail={"appointmentId": appointment.id},
    )
    return serialize_appointment_detail(appointment)


def today_summary(actor) -> dict:
    """Per-status counts for the appointment dashboard's "today" tab.

    A clinician also sees bookings that nobody has claimed yet
    (``doctor_id IS NULL``), because the public booking form lets a patient book
    without choosing a doctor. Without this, a real booking made today would be
    persisted but counted as zero — the same class of bug as the doctor being
    unable to list it.
    """
    role = _role(actor)
    doctor_id = actor.id if role == UserRole.doctor.value else None
    today = datetime.date.today()
    return {
        "date": today.isoformat(),
        "counts": appointment_repo.status_counts(
            doctor_id=doctor_id,
            day=today,
            include_unassigned=doctor_id is not None,
        ),
    }