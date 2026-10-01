"""Uniform JSON response envelopes.

Success responses are shaped as::

    {"success": true, "data": <payload>, ...optional legacy keys}

Errors are produced by the centralised handlers in :func:`app.create_app` and
are shaped as::

    {"success": false, "error": "<machine_code>", "message": "<human text>"}

The optional ``extra`` keys exist so already-shipped clients keep working (for
example the auth endpoints, whose response documents ``access_token`` at the
top level).
"""
from __future__ import annotations

from typing import Any

from flask import jsonify


def ok(data: Any = None, status: int = 200, **extra):
    """Return a success envelope with HTTP ``status``."""
    payload: dict[str, Any] = {"success": True, "data": data}
    payload.update({k: v for k, v in extra.items() if v is not None})
    return jsonify(payload), status


def created(data: Any = None, **extra):
    """201 Created shortcut."""
    return ok(data, status=201, **extra)


def error(message: str, code: str = "error", status: int = 400, **extra):
    """Return a failure envelope with HTTP ``status``."""
    payload: dict[str, Any] = {"success": False, "error": code, "message": message}
    payload.update(extra)
    return jsonify(payload), status


def paginated(items: list, total: int, page: int = 1, per_page: int | None = None, **extra):
    """Standard list envelope: ``data`` is the page of items."""
    payload_extra = {"total": total, "page": page}
    if per_page is not None:
        payload_extra["perPage"] = per_page
    payload_extra.update(extra)
    return ok(items, **payload_extra)