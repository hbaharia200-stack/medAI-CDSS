"""AI service adapter — the *only* place the trained model is executed.

Design rules honoured here (per the project brief):
  * The model is supplied by the modelling teammate as an artifact; it is NOT
    shipped in this repository and it is NEVER retrained or replaced here.
  * We never invent the feature contract: features come from
    ``ai.feature_engine.build_case_features`` and are mapped onto the feature
    names the artifact itself declares (``feature_names_in_`` or a
    ``feature_schema.json`` sidecar).
  * When no artifact is configured/available, ``AIModelNotConfigured`` is raised
    and the API answers 503 with a clear message — we never fabricate a
    prediction.

Output is normalised into the frontend contract (``AIRecommendation``):
``{diseaseName, confidence, confidenceScore, topSymptomsSummary,
reasoningFactors, recommendedTests}``.
"""
from __future__ import annotations

import os
import threading
from datetime import datetime, timezone

from flask import current_app

from app.ai import (
    AIModelNotConfigured,
    build_case_features,
    load_adapter,
    load_feature_schema,
    normalize_predictions,
    strip_internal,
)

# Adapter cache keyed by (path, format) so the artifact is loaded once per
# process instead of on every request. Guarded by a lock for threaded servers.
_CACHE: dict[tuple[str, str], object] = {}
_CACHE_LOCK = threading.Lock()


# ---------------------------------------------------------------------------
# Configuration access (works inside and outside an app context)
# ---------------------------------------------------------------------------


def _cfg(key: str, default=None):
    try:
        return current_app.config.get(key, default)
    except RuntimeError:  # no application context (e.g. a standalone script)
        return default


def model_path() -> str:
    return (_cfg("AI_MODEL_PATH", "") or "").strip()


def schema_path() -> str:
    return (_cfg("AI_FEATURE_SCHEMA_PATH", "") or "").strip()


def model_format() -> str:
    return (_cfg("AI_MODEL_FORMAT", "auto") or "auto").strip()


def confidence_thresholds() -> tuple[float, float]:
    return (
        float(_cfg("AI_CONFIDENCE_HIGH", 0.80) or 0.80),
        float(_cfg("AI_CONFIDENCE_MEDIUM", 0.55) or 0.55),
    )


# ---------------------------------------------------------------------------
# Adapter access
# ---------------------------------------------------------------------------


def is_configured() -> bool:
    """True when ``AI_MODEL_PATH`` points at an existing artifact."""
    path = model_path()
    return bool(path) and os.path.exists(path)


def get_adapter():
    """Return the cached model adapter, loading it on first use.

    Raises:
        AIModelNotConfigured: when no artifact is configured or it is missing.
    """
    path = model_path()
    if not path:
        raise AIModelNotConfigured(
            "No trained model artifact is configured. Set AI_MODEL_PATH to the "
            "artifact shipped by the modelling teammate (see backend/.env.example)."
        )
    if not os.path.exists(path):
        raise AIModelNotConfigured(
            f"The configured model artifact does not exist at AI_MODEL_PATH: {path}"
        )

    fmt = model_format()
    key = (path, fmt)
    adapter = _CACHE.get(key)
    if adapter is None:
        with _CACHE_LOCK:
            adapter = _CACHE.get(key)
            if adapter is None:
                adapter = load_adapter(
                    path, fmt, feature_schema=load_feature_schema(schema_path())
                )
                _CACHE[key] = adapter
    return adapter


def reset_cache() -> None:
    """Drop the cached adapter (admin reload endpoint + tests)."""
    with _CACHE_LOCK:
        _CACHE.clear()


def model_version() -> str:
    """Human-readable model identity stored alongside each recommendation."""
    adapter = get_adapter()
    return f"{getattr(adapter, 'model_name', None) or type(adapter).__name__}:{os.path.basename(model_path())}"


def model_status() -> dict:
    """Non-clinical model status for /api/ai/status and the admin dashboard."""
    path = model_path()
    status = {
        "configured": is_configured(),
        "modelPath": path or None,
        "format": model_format(),
        "featureSchemaPath": schema_path() or None,
        "featureNames": None,
        "modelName": None,
        "loaded": False,
    }
    if status["configured"]:
        try:
            adapter = get_adapter()
            status["loaded"] = True
            status["featureNames"] = adapter.feature_names
            status["modelName"] = getattr(adapter, "model_name", None)
        except Exception as exc:  # noqa: BLE001 — report, never crash the status check
            status["error"] = f"{type(exc).__name__}: {exc}"
    return status


# ---------------------------------------------------------------------------
# Inference
# ---------------------------------------------------------------------------


def describe_feature_alignment(adapter, features: dict) -> dict:
    """Report how the generated features line up with the model's own schema.

    Deliberately explicit: if the artifact declares no feature names we say so
    instead of silently guessing the column order.
    """
    names = adapter.feature_names
    if not names:
        return {
            "aligned": False,
            "reason": (
                "The artifact does not declare feature_names_in_ and no "
                "AI_FEATURE_SCHEMA_PATH sidecar is configured, so feature "
                "ordering cannot be verified against training time."
            ),
            "modelFeatureCount": None,
            "missingForModel": None,
            "unusedFeatures": None,
        }
    missing = [n for n in names if n not in features]
    unused = [k for k in features if k not in names]
    return {
        "aligned": not missing,
        "reason": None if not missing else f"{len(missing)} model feature(s) absent from the case payload.",
        "modelFeatureCount": len(names),
        "missingForModel": missing,
        "unusedFeatures": unused,
    }


def _safe_model_version(adapter) -> str:
    name = getattr(adapter, "model_name", None) or type(adapter).__name__
    return f"{name}:{os.path.basename(model_path())}"


def predict(case_dict: dict) -> list[dict]:
    """Run the real trained model for a serialized clinical case.

    Args:
        case_dict: serialized case (patient / symptoms / vitals / history).

    Returns:
        Normalised recommendations (including backend-only provenance keys).

    Raises:
        AIModelNotConfigured: no usable artifact.
    """
    adapter = get_adapter()
    features = build_case_features(case_dict)
    alignment = describe_feature_alignment(adapter, features)
    if not alignment["aligned"]:
        # Never invent inputs: make the mismatch loud in the server log so the
        # modelling teammate can ship the correct schema — but do not fabricate
        # values, and do not silently reorder when the model declared nothing.
        try:
            current_app.logger.warning(
                "AI feature/artifact schema mismatch: %s", alignment["reason"]
            )
        except RuntimeError:  # no app context
            pass

    raw_predictions = adapter.predict(features)
    high_t, med_t = confidence_thresholds()
    top_k = int(_cfg("AI_RECOMMENDATION_TOP_K", 3) or 3)
    return normalize_predictions(
        raw_predictions,
        case_dict=case_dict,
        high_t=high_t,
        med_t=med_t,
        top_k=top_k,
        model_version=_safe_model_version(adapter),
    )


def predict_for_client(case_dict: dict) -> list[dict]:
    """Normalised recommendations with backend-only keys removed."""
    return [strip_internal(r) for r in predict(case_dict)]


def health() -> dict:
    """Small AI block for /api/health."""
    return {
        "configured": is_configured(),
        "modelName": model_status().get("modelName") if is_configured() else None,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
    }