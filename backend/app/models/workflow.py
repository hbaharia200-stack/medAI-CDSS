"""Workflow entities: appointments."""
from __future__ import annotations

from app.extensions import db
from app.utils import gen_uuid
from . import AppointmentStatus


class Appointment(db.Model):
    """A scheduled appointment between a patient and a doctor."""

    __tablename__ = "appointments"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=gen_uuid)

    patient_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True, index=True)

    title = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=True)
    fees = db.Column(db.Numeric(10, 2), nullable=True, default=0)
    status = db.Column(
        db.Enum(AppointmentStatus, native_enum=False, length=16),
        nullable=False,
        default=AppointmentStatus.scheduled,
        index=True,
    )

    created_at = db.Column(db.DateTime, default=db.func.now(), nullable=False)
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now(), nullable=False)

    patient = db.relationship("User", foreign_keys=[patient_id], backref="appointments_as_patient")
    doctor = db.relationship("User", foreign_keys=[doctor_id], backref="appointments_as_doctor")
