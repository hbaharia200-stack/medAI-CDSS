"""AI service package — model adapter + feature prep + normalization.

Public entry point: ``AIService`` (in app.services.ai_service), which uses
``load_adapter`` / ``build_case_features`` / ``normalize_predictions`` from
here. The model artifact is loaded ONLY when ``AI_MODEL_PATH`` is set and the
file exists; otherwise :class:`AIModelNotConfigured` is raised so the API can
return a safe 503 instead of fabricating a prediction.
"""
from __future__ import annotations

from .adapters import AIModelNotConfigured, ModelAdapter
from .loader import load_adapter, load_feature_schema
from .feature_engine import build_case_features, DEFAULT_DISEASE_TESTS
from .normalizer import normalize_predictions, strip_internal

__all__ = [
    "AIModelNotConfigured",
    "ModelAdapter",
    "load_adapter",
    "load_feature_schema",
    "build_case_features",
    "DEFAULT_DISEASE_TESTS",
    "normalize_predictions",
    "strip_internal",
]
