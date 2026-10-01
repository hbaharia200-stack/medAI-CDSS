"""NLP (mobile symptom-intake extraction) API.

GET  /api/nlp/status   auth — honest capability report (no model is bundled)
POST /api/nlp/extract   auth — {text: "..."} -> symptoms[]; 503 when no model
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import jwt_required

from app.ai import AIModelNotConfigured
from app.api._helpers import json_body
from app.services import nlp_service
from app.utils import ValidationError, error, ok

bp = Blueprint("nlp", __name__, url_prefix="/api/nlp")


@bp.route("/status", methods=["GET"])
@jwt_required()
def status():
    return ok(nlp_service.status())


@bp.route("/extract", methods=["POST"])
@jwt_required()
def extract():
    data = json_body()
    text = data.get("text") or data.get("message") or ""
    if not str(text).strip():
        raise ValidationError("'text' is required.", "required_field_missing")
    try:
        symptoms, meta = nlp_service.extract(str(text))
    except AIModelNotConfigured as exc:
        # Never fake model output: 503 with the honest reason.
        return error(str(exc), "nlp_model_not_configured", 503)
    return ok({"symptoms": symptoms, "meta": meta})

