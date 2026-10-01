"""Blueprint collection + API root.

Each domain module exposes a ``bp`` Flask blueprint. ``register_api`` attaches
them all under ``/api`` and registers a small landing page so the server is
self-describing.
"""
from __future__ import annotations

from flask import Blueprint, Flask, jsonify
from app.utils import ok


def _import_blueprints():
    from . import (
        appointments,
        agent,
        auth,
        billing,
        cases,
        contact_messages,
        dashboard,
        diagnosis,
        messages,
        nlp,
        nurses,
        patients,
        recommendations,
        statistics,
        staff,
    )

    return [
        auth.bp,
        agent.bp,
        patients.bp,
        nurses.bp,
        cases.bp,
        diagnosis.bp,
        recommendations.bp,
        appointments.bp,
        messages.bp,
        contact_messages.bp,
        billing.bp,
        dashboard.bp,
        statistics.bp,
        staff.bp,
        nlp.bp,
    ]


def register_api(app: Flask) -> None:
    api = Blueprint("api", __name__, url_prefix="/api")

    @api.route("/health", methods=["GET"])
    def health():
        from app.services import ai_service
        return ok({
            "status": "ok",
            "service": "medai-backend",
            "ai": ai_service.health(),
        })

    @api.route("", methods=["GET"])
    def index():
        return jsonify({
            "service": "MedAI Backend API",
            "status": "running",
            "endpoints": {
                "auth": "/api/auth",
                "patients": "/api/patients",
                "cases": "/api/cases",
                "predict": "/api/predict",
                "nlp": "/api/nlp/extract",
                "agent": "/api/agent/chat",
            },
        })

    app.register_blueprint(api)

    for bp in _import_blueprints():
        app.register_blueprint(bp)
