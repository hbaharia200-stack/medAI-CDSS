"""Security helpers: password hashing, identifiers, role authorization."""
from __future__ import annotations

import uuid
from functools import wraps

from flask_jwt_extended import current_user, verify_jwt_in_request
from werkzeug.security import check_password_hash, generate_password_hash

VALID_ROLES = {"patient", "nurse", "doctor", "admin"}


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Password hashing (Werkzeug PBKDF2). Nurses/doctors are passwordless and store
# password_hash = NULL — this is the intentional, documented design.
# ---------------------------------------------------------------------------


def hash_password(password: str) -> str | None:
    """Hash a password using Werkzeug's PBKDF2. Returns None if password empty."""
    if not password:
        return None
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Verify a password against its hash. ``password_hash`` may be None
    (passwordless account) — in that case verification always fails."""
    if not password_hash:
        return False
    return check_password_hash(password_hash, password)


# ---------------------------------------------------------------------------
# Role-based authorization
# ---------------------------------------------------------------------------


def role_required(*roles: str):
    """Decorator enforcing the caller has one of the given roles.

    Usage: @role_required('doctor')  or  @role_required('admin','doctor')
    """
    def wrapper(fn):
        @wraps(fn)
        def inner(*args, **kwargs):
            verify_jwt_in_request()
            if not current_user or current_user.role not in roles:
                return {"error": "forbidden", "message": "Insufficient role for this action."}, 403
            return fn(*args, **kwargs)
        return inner
    return wrapper


def permission_required(*roles: str):
    """Readability alias for role_required."""
    return role_required(*roles)


def get_current_user_id() -> str | None:
    """Return the authenticated user's id, or None if unauthenticated."""
    try:
        verify_jwt_in_request()
    except Exception:
        return None
    return getattr(current_user, "id", None)
