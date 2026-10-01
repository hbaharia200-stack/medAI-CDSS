"""Authentication service - login, token issuance, refresh & logout.

See auth_service.py for registration rules. Login supports two models:
  * nurse/doctor: passwordless via Staff ID.
  * patient/admin: identifier + password (hashed) verification.
"""
from __future__ import annotations

from datetime import datetime, timezone

from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt,
    get_jwt_identity,
)

from app.extensions import db
from app.models import User, UserRole
from app.repositories import get_user_by_id, get_user_by_identifier, get_user_by_staff_id
from app.utils import AuthError, verify_password


def _issue_tokens(user: User):
    additional = {"role": user.role.value, "staff_id": user.staff_id}
    access = create_access_token(identity=user.id, additional_claims=additional)
    refresh = create_refresh_token(identity=user.id, additional_claims=additional)
    return access, refresh, user


def _match_staff_identifier(identifier: str) -> User | None:
    """Best-effort match for a nurse/doctor login identifier (staff id/name/phone).

    Staff ID and name matching is case-insensitive so ``dr002`` and ``DR002``
    both resolve to the same seeded account; phone numbers are matched exactly.
    """
    if not identifier:
        return None
    ident = str(identifier).strip()
    if not ident:
        return None
    lowered = ident.lower()
    return (
        db.session.query(User)
        .filter(
            db.or_(
                db.func.lower(User.staff_id) == lowered,
                db.func.lower(User.full_name) == lowered,
                User.phone == ident,
            )
        )
        .first()
    )


def _role_allows_login(user_role: UserRole, requested: str) -> bool:
    if user_role == UserRole.patient:
        return requested in ("", UserRole.patient.value)
    if user_role == UserRole.admin:
        return requested in ("", UserRole.admin.value)
    return False


def login(data: dict):
    """Authenticate and issue JWT tokens. Returns (access, refresh, user)."""
    role = (data.get("role") or "").strip().lower()
    identifier = (data.get("identifier") or data.get("staffId") or data.get("email") or "").strip()
    staff_id = (data.get("staffId") or "").strip()
    password = data.get("password") or ""

    if not identifier and not staff_id:
        raise AuthError("credentials_required", "A credential is required.", 422)

    # Staff (nurse/doctor) - passwordless via Staff ID.
    if role in (UserRole.nurse.value, UserRole.doctor.value):
        credential = staff_id or identifier
        if not credential:
            raise AuthError("staff_id_required", "Staff ID is required.", 422)
        user = get_user_by_staff_id(credential)
        if user is None:
            user = _match_staff_identifier(identifier)
        if user is None or user.role.value != role:
            raise AuthError("invalid_credentials", "No matching account for that Staff ID.", 401)
        if not user.is_active:
            raise AuthError("account_disabled", "Account is disabled.", 403)
        return _issue_tokens(user)

    # Patient or admin - identifier + password.
    if role in (UserRole.patient.value, UserRole.admin.value, ""):
        user = get_user_by_identifier(identifier) if identifier else None
        if user is None and staff_id:
            user = get_user_by_staff_id(staff_id)
        if user is None or not _role_allows_login(user.role, role):
            raise AuthError("invalid_credentials", "Incorrect credentials.", 401)
        if not verify_password(password or "", user.password_hash):
            raise AuthError("invalid_credentials", "Incorrect credentials.", 401)
        if not user.is_active:
            raise AuthError("account_disabled", "Account is disabled.", 403)
        return _issue_tokens(user)

    raise AuthError("invalid_role", f"Unknown role '{role}'.", 422)


def refresh_access_token() -> str:
    """Issue a fresh access token from a valid refresh token."""
    current_id = get_jwt_identity()
    user = get_user_by_id(current_id)
    if user is None or not user.is_active:
        raise AuthError("invalid_session", "Session is no longer valid.", 401)
    return _issue_tokens(user)[0]


def revoke_refresh_token() -> None:
    """Blocklist the presented refresh token (real backend revocation)."""
    from app.models import TokenBlocklist
    jwt_payload = get_jwt()
    jti = jwt_payload["jti"]
    exp = jwt_payload["exp"]
    token_type = jwt_payload.get("type", "refresh")
    db.session.add(
        TokenBlocklist(jti=jti, token_type=token_type, expires_at=datetime.fromtimestamp(exp, tz=timezone.utc))
    )
    db.session.commit()
