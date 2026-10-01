"""Utility helpers: security, permissions, validation, errors.

Re-exports the public helpers so callers can still do ``from app.utils import ...``.
"""
from .security import (
    VALID_ROLES,
    gen_uuid,
    get_current_user_id,
    hash_password,
    permission_required,
    role_required,
    verify_password,
)
from .errors import AppError, AuthError, ConflictError, NotFoundError
from .validation import (
    SEX_VALUES,
    ValidationError,
    is_valid_email,
    normalize_sex,
    require_json_fields,
    coerce_bool,
    validate_vitals,
    parse_date,
    parse_time,
)
from .responses import created, error, ok, paginated

__all__ = [
    "VALID_ROLES",
    "gen_uuid",
    "hash_password",
    "verify_password",
    "role_required",
    "permission_required",
    "get_current_user_id",
    "AppError",
    "AuthError",
    "ConflictError",
    "NotFoundError",
    "ValidationError",
    "require_json_fields",
    "normalize_sex",
    "SEX_VALUES",
    "validate_vitals",
    "is_valid_email",
    "coerce_bool",
    "parse_date",
    "parse_time",
    "ok",
    "created",
    "error",
    "paginated",
]
