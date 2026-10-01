"""Appointment queries with the filters the doctor dashboard needs.

``list_*`` helpers return (rows, total) pairs so routes can paginate without
loading the whole table.
"""
from __future__ import annotations

import datetime

from app.extensions import db
from app.models import Appointment, AppointmentStatus


def day_bounds(day: datetime.date) -> tuple[datetime.datetime, datetime.datetime]:
    start = datetime.datetime.combine(day, datetime.time.min)
    return start, start + datetime.timedelta(days=1)


def _apply_filters(
    query,
    *,
    doctor_id: str | None = None,
    patient_id: str | None = None,
    status: str | None = None,
    day: datetime.date | None = None,
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    include_unassigned: bool = False,
):
    if doctor_id:
        # ``include_unassigned`` lets a clinician also see bookings that nobody
        # has claimed yet (doctor_id IS NULL) — otherwise a public booking made
        # without choosing a doctor would be persisted but invisible to everyone.
        query = query.filter(
            db.or_(
                Appointment.doctor_id == doctor_id,
                Appointment.doctor_id.is_(None),
            )
            if include_unassigned
            else Appointment.doctor_id == doctor_id
        )
    if patient_id:
        query = query.filter(Appointment.patient_id == patient_id)
    if status:
        query = query.filter(Appointment.status == AppointmentStatus(status))
    if day is not None:
        start, end = day_bounds(day)
        query = query.filter(Appointment.start_time >= start, Appointment.start_time < end)
    if date_from is not None:
        query = query.filter(Appointment.start_time >= datetime.datetime.combine(date_from, datetime.time.min))
    if date_to is not None:
        query = query.filter(
            Appointment.start_time < datetime.datetime.combine(date_to, datetime.time.min)
            + datetime.timedelta(days=1)
        )
    return query


def list_appointments(
    *,
    doctor_id: str | None = None,
    patient_id: str | None = None,
    status: str | None = None,
    day: datetime.date | None = None,
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    order: str = "asc",
    limit: int | None = None,
    offset: int = 0,
    include_unassigned: bool = False,
) -> tuple[list[Appointment], int]:
    query = _apply_filters(
        db.session.query(Appointment),
        doctor_id=doctor_id,
        patient_id=patient_id,
        status=status,
        day=day,
        date_from=date_from,
        date_to=date_to,
        include_unassigned=include_unassigned,
    )
    total = query.count()
    ordered = query.order_by(
        Appointment.start_time.asc() if order == "asc" else Appointment.start_time.desc()
    )
    if offset:
        ordered = ordered.offset(offset)
    if limit is not None:
        ordered = ordered.limit(limit)
    return ordered.all(), total


def get_appointment(appointment_id: str) -> Appointment | None:
    return db.session.get(Appointment, appointment_id)


def create_appointment(
    *,
    patient_id: str,
    doctor_id: str | None,
    title: str,
    start_time: datetime.datetime,
    end_time: datetime.datetime | None = None,
    description: str | None = None,
    fees: float | None = None,
    status: str = AppointmentStatus.pending.value,
) -> Appointment:
    appointment = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        title=title,
        description=description,
        start_time=start_time,
        end_time=end_time,
        fees=fees,
        status=AppointmentStatus(status),
    )
    db.session.add(appointment)
    db.session.flush()
    return appointment


def save(appointment: Appointment, *, commit: bool = True) -> Appointment:
    db.session.add(appointment)
    if commit:
        db.session.commit()
    return appointment


def has_conflict(
    doctor_id: str,
    start_time: datetime.datetime,
    *,
    exclude_id: str | None = None,
) -> bool:
    """True when the doctor already has an active booking at that exact slot."""
    if not doctor_id:
        return False
    query = db.session.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.start_time == start_time,
        Appointment.status.in_(
            [AppointmentStatus.pending, AppointmentStatus.confirmed, AppointmentStatus.scheduled]
        ),
    )
    if exclude_id:
        query = query.filter(Appointment.id != exclude_id)
    return query.first() is not None


def status_counts(
    *,
    doctor_id: str | None = None,
    day: datetime.date | None = None,
    include_unassigned: bool = False,
) -> dict[str, int]:
    query = _apply_filters(
        db.session.query(Appointment),
        doctor_id=doctor_id,
        day=day,
        include_unassigned=include_unassigned,
    )
    rows = query.with_entities(Appointment.status, db.func.count(Appointment.id)).group_by(Appointment.status).all()
    return {(s.value if hasattr(s, "value") else str(s)): int(c) for s, c in rows}


def upcoming_for_doctor(doctor_id: str, limit: int = 10) -> list[Appointment]:
    rows, _ = list_appointments(
        doctor_id=doctor_id,
        date_from=datetime.date.today(),
        order="asc",
        limit=limit,
    )
    return rows