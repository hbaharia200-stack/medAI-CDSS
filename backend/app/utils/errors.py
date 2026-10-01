"""Application error types.

``AppError`` is the base class for controlled, expected errors. The factory
registers an ``errorhandler(AppError)`` so any service raising one returns a
clean JSON response with the right status — no stack traces leak to clients.
"""
from __future__ import annotations


class AppError(Exception):
    """Base for expected, client-facing errors."""

    def __init__(self, message: str, code: str = "error", status: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status

    def to_dict(self) -> dict:
        return {"error": self.code, "message": self.message}


class AuthError(AppError):
    """Raised by authentication flows (bad credentials, conflict, disabled)."""

    def __init__(self, code: str, message: str, status: int = 422):
        super().__init__(message, code, status)


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", code: str = "not_found"):
        super().__init__(message, code, 404)


class ConflictError(AppError):
    def __init__(self, message: str, code: str = "conflict"):
        super().__init__(message, code, 409)
