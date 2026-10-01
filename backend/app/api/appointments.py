"""Appointments API.

Endpoints
---------
POST   /api/appointments             public — landing-page booking form
GET    /api/appointments             auth   — list with filters
GET    /api/appointments/today       auth   — today's per-status counts
GET    /api/appointments/<id>        auth   — single appointment with contacts
PATCH  /api/appointments/<id>        auth   — confirm / reschedule / cancel
POST   /api/appointments/<id>/cancel auth   — cancel (patients may cancel own)

Public booking is enabled by default via ``APPOINTMENTS_PUBLIC_BOOKING``.
"""
from __future__ import annotations

from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import current_user, jwt_required

from app.api._helpers import int_arg, json_body, role_guard, str_arg
from app.services import appointment_service
from app.utils import ok

bp = Blueprint("appointments", __name__, url_prefix="/api/appointments")


@bp.route("", methods=["POST"])
def book_appointment():
    if not current_app.config.get("APPOINTMENTS_PUBLIC_BOOKING", True):
        return {
            "success": False,
            "error": "booking_disabled",
            "message": "Public booking is disabled. Please contact the facility.",
        }, 403
    appointment = appointment_service.book_from_public_form(json_body())
    # The public frontend (web/src/services/api/appointmentService.ts) reads
    # `id` and `status` at the TOP LEVEL of the JSON body. `ok()` reserves
    # `status` for the HTTP code, so this envelope is built explicitly.
    body = {
        "success": True,
        "data": appointment,
        "id": appointment.get("id"),
        "appointmentStatus": appointment.get("status"),
        "status": appointment.get("status"),
    }
    return jsonify(body), 201


@bp.route("", methods=["GET"])
@jwt_required()
def list_appointments():
    result = appointment_service.list_appointments(
        current_user,
        doctor_id=str_arg("doctor_id"),
        patient_id=str_arg("patient_id"),
        status=str_arg("status"),
        day=str_arg("date"),
        date_from=str_arg("from"),
        date_to=str_arg("to"),
        order=str_arg("order", "asc"),
        limit=int_arg("limit", minimum=1, maximum=500),
        offset=int_arg("offset", 0, minimum=0),
    )
    return ok(result["items"], 200, total=result["total"])


@bp.route("/today", methods=["GET"])
@jwt_required()
def today():
    return ok(appointment_service.today_summary(current_user))


@bp.route("/<appointment_id>", methods=["GET"])
@jwt_required()
def get_appointment(appointment_id: str):
    return ok(appointment_service.get_appointment(appointment_id, current_user))


@bp.route("/<appointment_id>", methods=["PATCH"])
@role_guard("doctor", "nurse", "admin", "patient")
def update_appointment(appointment_id: str):
    return ok(appointment_service.update_appointment(appointment_id, json_body(), current_user))


@bp.route("/<appointment_id>/cancel", methods=["POST"])
@role_guard("doctor", "nurse", "admin", "patient")
def cancel_appointment(appointment_id: str):
    return ok(appointment_service.cancel_appointment(appointment_id, current_user))


@bp.route("/<appointment_id>/confirm", methods=["POST"])
@role_guard("doctor", "nurse", "admin")
def confirm_appointment(appointment_id: str):
    return ok(appointment_service.confirm_appointment(appointment_id, current_user))
