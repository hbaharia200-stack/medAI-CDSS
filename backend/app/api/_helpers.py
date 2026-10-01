"""Small helpers shared by the API blueprints (query parsing, role guards)."""
from __future__ import annotations

from functools import wraps

from flask import jsonify, request
from flask_jwt_extended import current_user, jwt_required

from app.utils import ValidationError


def json_body() -> dict:
    """Return the JSON body or raise a 422 for malformed JSON."""
    data = request.get_json(silent=True)
    if data is None:
        raise ValidationError("Request body must be valid JSON.", "invalid_json")
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object.", "invalid_json")
    return data


def str_arg(name: str, default=None):
    value = request.args.get(name)
    if value is None or value == "":
        return default
    return value.strip()


def bool_arg(name: str):
    raw = request.args.get(name)
    if raw is None or raw == "":
        return None
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def int_arg(name: str, default=None, minimum=None, maximum=None):
    raw = request.args.get(name)
    if raw is None or raw == "":
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError) as exc:
        raise ValidationError(f"'{name}' must be an integer.", "invalid_query_param") from exc
    if minimum is not None and value < minimum:
        raise ValidationError(f"'{name}' must be >= {minimum}.", "invalid_query_param")
    if maximum is not None and value > maximum:
        raise ValidationError(f"'{name}' must be <= {maximum}.", "invalid_query_param")
    return value


def role_guard(*roles: str):
    """``@role_guard('doctor','admin')`` — 401 without a token, 403 for wrong role.

    Authorization always happens server-side; the frontend's role is never
    trusted (the role is read from the verified JWT -> User lookup).
    """

    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def inner(*args, **kwargs):
            user = current_user
            user_role = getattr(user, "role", None)
            user_role = user_role.value if hasattr(user_role, "value") else user_role
            if user is None:
                return jsonify({"success": False, "error": "unauthorized", "message": "Authentication required."}), 401
            if not getattr(user, "is_active", True):
                return jsonify({"success": False, "error": "account_disabled", "message": "Account is disabled."}), 403
            if roles and user_role not in roles:
                return jsonify({
                    "success": False,
                    "error": "forbidden",
                    "message": f"This action requires one of these roles: {', '.join(roles)}.",
                }), 403
            return fn(*args, **kwargs)

        return inner

    return decorator


def current_actor():
    """The authenticated ``User`` (requires a jwt-guarded route)."""
    return current_user