"""AI model adapters — base contract + shared helpers + sklearn loader.

Framework-specific adapters (torch/onnx/keras) live in ``format_adapters`` and
import their ML runtimes lazily so the backend boots without every runtime
installed.

Design note (per project rules): we never invent model preprocessing here.
Features are produced by ``feature_engine.build_case_features`` and, when
available, mapped to the model's own declared feature names. Until the modelling
teammate ships the real artifact to ``AI_MODEL_PATH``, ``AIService.predict``
raises ``AIModelNotConfigured`` and endpoints return 503 — no fake predictions.
"""
from __future__ import annotations


class AIModelNotConfigured(Exception):
    """Raised when no usable AI model artifact is configured/available."""


class ModelAdapter:
    """Uniform contract every format-specific adapter implements."""

    model_name: str = "base"

    @property
    def feature_names(self) -> list[str] | None:
        """Feature names the model expects (in order), or None if unknown."""
        return None

    def predict(self, features: dict | list) -> list[dict]:
        """Return raw predictions, each a dict: {'label','score','raw'}."""
        raise NotImplementedError

    def _order_features(self, features: dict | list, feature_names: list[str] | None = None) -> list:
        """Instance-friendly wrapper around the module-level feature ordering."""
        names = feature_names if feature_names is not None else self.feature_names
        return _order_features(features, names)


# ---------------------------------------------------------------------------
# Shared helpers (no framework imports)
# ---------------------------------------------------------------------------


def _order_features(features: dict | list, feature_names: list[str] | None) -> list:
    """Map a case feature dict into the ordered list the model expects."""
    if isinstance(features, list):
        return list(features)
    if feature_names:
        return [float(features.get(name, 0.0)) for name in feature_names]
    # Deterministic fallback: sorted keys. A real schema/feature_names_in_
    # should always be used so positional order matches training time.
    return [float(features[k]) for k in sorted(features)]


def _to_numpy(x):
    import numpy as np
    if isinstance(x, np.ndarray):
        return x
    if hasattr(x, "tolist"):
        return np.array(x.tolist())
    return np.array(x)


def _maybe_softmax(arr):
    """If values look like logits (any <0 or sum far from 1), apply softmax."""
    import numpy as np
    if (arr < 0).any() or abs(float(arr.sum()) - 1.0) > 0.1:
        e = np.exp(arr - arr.max())
        return e / e.sum()
    return arr


def _normalize_tensor_like(out) -> list[dict]:
    """Convert logits/proba tensor/array into scored per-class predictions."""
    arr = out.detach().cpu().numpy() if hasattr(out, "detach") else _to_numpy(out)
    arr = _maybe_softmax(arr.reshape(-1))
    return [{"label": f"class_{i}", "score": float(p), "raw": {"proba": float(p)}} for i, p in enumerate(arr)]


# ---------------------------------------------------------------------------
# sklearn / joblib (.pkl, .joblib)
# ---------------------------------------------------------------------------


class SklearnAdapter(ModelAdapter):
    def __init__(self, path: str, feature_schema: list[str] | None = None):
        import joblib
        self.model = joblib.load(path)
        self._feature_schema = feature_schema

    @property
    def model_name(self) -> str:
        return type(self.model).__name__

    @property
    def feature_names(self) -> list[str] | None:
        fn = getattr(self.model, "feature_names_in_", None)
        if fn is not None:
            return list(fn)
        return self._feature_schema

    def predict(self, features: dict | list) -> list[dict]:
        ordered = _order_features(features, self.feature_names)
        preds = self.model.predict([ordered])[0]
        out: list[dict] = []
        proba = getattr(self.model, "predict_proba", None)
        classes = getattr(self.model, "classes_", None)
        if proba is not None and classes is not None:
            probs = proba([ordered])[0]
            scored = list(zip(list(classes), list(probs)))
            scored.sort(key=lambda x: x[1], reverse=True)
            out = [{"label": str(lbl), "score": float(p), "raw": {"proba": float(p)}} for lbl, p in scored]
        else:
            out = [{"label": str(preds), "score": 1.0, "raw": {"prediction": str(preds)}}]
        return out
