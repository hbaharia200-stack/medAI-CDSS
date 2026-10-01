"""Dashboard aggregation API (real database figures only).

GET /api/dashboard/basic         staff — headline counts for the active dashboard
GET /api/dashboard/patients      staff — patient demographics + growth
GET /api/dashboard/diagnosis     staff — diagnosis distribution + AI feedback
GET /api/dashboard/appointments  staff — today/upcoming/pending appointments
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user

from app.api._helpers import role_guard
from app.services import dashboard_service
from app.utils import ok

bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

STAFF = ("nurse", "doctor", "admin")


@bp.route("/basic", methods=["GET"])
@role_guard(*STAFF)
def basic():
    return ok(dashboard_service.basic(current_user))


@bp.route("/patients", methods=["GET"])
@role_guard(*STAFF)
def patients():
    return ok(dashboard_service.patients(current_user))


@bp.route("/diagnosis", methods=["GET"])
@role_guard(*STAFF)
def diagnosis():
    return ok(dashboard_service.diagnosis(current_user))


@bp.route("/appointments", methods=["GET"])
@role_guard(*STAFF)
def appointments():
    return ok(dashboard_service.appointments(current_user))

