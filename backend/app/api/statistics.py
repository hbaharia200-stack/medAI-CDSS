"""Statistics + admin oversight API.

GET /api/statistics         staff  — full facility/patient statistics payload
GET /api/statistics/audit   admin  — audit-log feed (clinical detail, admin-only)
GET /api/statistics/health  admin  — real service health (db + AI + counts)
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import current_user

from app.api._helpers import int_arg, role_guard
from app.services import dashboard_service
from app.utils import ok

bp = Blueprint("statistics", __name__, url_prefix="/api/statistics")


@bp.route("", methods=["GET"])
@role_guard("nurse", "doctor", "admin")
def statistics():
    return ok(dashboard_service.statistics(current_user))


@bp.route("/audit", methods=["GET"])
@role_guard("admin")
def audit():
    return ok(dashboard_service.audit_feed(limit=int_arg("limit", 50, minimum=1, maximum=200)))


@bp.route("/health", methods=["GET"])
@role_guard("admin")
def health():
    return ok(dashboard_service.system_health(current_user))

