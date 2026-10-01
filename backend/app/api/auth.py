"""Auth API: registration, login, token refresh, logout, current user.

The JWT access token carries the user's ``id`` as subject plus ``role`` and
``staff_id`` claims. The factory's ``user_lookup_loader`` resolves the subject
to a ``User``, so ``current_user`` is available on protected routes.
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from app.models import UserRole
from app.schemas import serialize_user
from app.services import auth_login, auth_service
from app.utils import require_json_fields

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.route("/register", methods=["POST"])
def register():
    data = require_json_fields("role")
    role = (data.get("role") or "").strip().lower()
    if role not in UserRole.values():
        return jsonify({"error": "invalid_role", "message": "role must be one of: patient, nurse, doctor, admin."}), 422
    user = auth_service.register(data)
    return jsonify({"message": "Registered successfully.", "user": serialize_user(user)}), 201


@bp.route("/login", methods=["POST"])
def login():
    data = require_json_fields("role")
    access, refresh, user = auth_login.login(data)
    return jsonify({
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "Bearer",
        "user": serialize_user(user),
    }), 200


@bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    access = auth_login.refresh_access_token()
    return jsonify({"access_token": access, "token_type": "Bearer"}), 200


@bp.route("/logout", methods=["POST"])
@jwt_required(refresh=True)
def logout():
    auth_login.revoke_refresh_token()
    return jsonify({"message": "Logged out."}), 200


@bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Current user. Doctors also get their persisted availability so the web
    Settings toggle can render the saved state after a refresh or a fresh
    login without a second round-trip."""
    user = serialize_user(current_user)
    if current_user.role == UserRole.doctor:
        from app.services import availability_service

        user.update(availability_service.status_payload(current_user.id))
    return jsonify({"user": user}), 200


# ---------------------------------------------------------------------------
# Doctor availability (Settings -> Available | Not Available)
#
# Persisted on DoctorProfile, so the value survives refresh and logout/login.
# ---------------------------------------------------------------------------


@bp.route("/me/availability", methods=["GET"])
@jwt_required()
def my_availability():
    from app.services import availability_service

    return jsonify({"data": availability_service.get_my_availability(current_user)}), 200


@bp.route("/me/availability", methods=["PATCH"])
@jwt_required()
def update_my_availability():
    from app.services import availability_service

    data = request.get_json(silent=True) or {}
    value = data.get("availability", data.get("isAvailable"))
    return jsonify({"data": availability_service.set_availability(current_user, value)}), 200
