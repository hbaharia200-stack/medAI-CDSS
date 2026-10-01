"""Format factory: pick the right adapter class from a path / format hint."""
from __future__ import annotations

import json
import os

from .adapters import (
    AIModelNotConfigured,
    ModelAdapter,
    SklearnAdapter,
)
from .format_adapters import KerasAdapter, OnnxAdapter, TorchAdapter

_EXTENSION_MAP = {
    ".pkl": SklearnAdapter,
    ".joblib": SklearnAdapter,
    ".pt": TorchAdapter,
    ".pth": TorchAdapter,
    ".onnx": OnnxAdapter,
    ".keras": KerasAdapter,
    ".h5": KerasAdapter,
    ".pb": SklearnAdapter,
}

_FORMAT_MAP = {
    "sklearn": SklearnAdapter,
    "torch": TorchAdapter,
    "onnx": OnnxAdapter,
    "keras": KerasAdapter,
}


def load_adapter(path: str, fmt: str = "auto", feature_schema: list[str] | None = None) -> ModelAdapter:
    """Build the correct adapter for ``path`` based on format/extension.

    Raises ``AIModelNotConfigured`` for unsupported/blank/missing paths.
    """
    if not path or not os.path.exists(path):
        raise AIModelNotConfigured(f"Model artifact not found at path: {path}")

    if fmt == "auto":
        ext = os.path.splitext(path)[1].lower()
        cls = _EXTENSION_MAP.get(ext)
    else:
        cls = _FORMAT_MAP.get(fmt)

    if cls is None:
        raise AIModelNotConfigured(
            f"Unsupported model format for '{path}'. Set AI_MODEL_FORMAT to one of: "
            "sklearn, torch, onnx, keras."
        )
    return cls(path, feature_schema=feature_schema)


def load_feature_schema(schema_path: str | None) -> list[str] | None:
    """Optional JSON sidecar describing model feature names/order.

    Accepted shapes: {"features": ["a","b",...]} or a bare list ["a","b",...].
    """
    if not schema_path or not os.path.exists(schema_path):
        return None
    with open(schema_path) as f:
        data = json.load(f)
    if isinstance(data, dict):
        return data.get("features")
    if isinstance(data, list):
        return data
    return None

