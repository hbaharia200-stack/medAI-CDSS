"""Framework-specific adapters: PyTorch (.pt/.pth), ONNX (.onnx), Keras (.keras/.h5).

Each imports its ML runtime lazily in ``__init__`` so the backend runs without
every runtime installed.
"""
from __future__ import annotations

from .adapters import (
    ModelAdapter,
    _normalize_tensor_like,
    _order_features,
    _to_numpy,
    _maybe_softmax,
)


class TorchAdapter(ModelAdapter):
    def __init__(self, path: str, feature_schema: list[str] | None = None):
        import torch
        self._torch = torch
        self.model = torch.load(path, map_location="cpu")
        self.model.eval()
        self._feature_schema = feature_schema

    @property
    def model_name(self) -> str:
        return type(self.model).__name__

    @property
    def feature_names(self) -> list[str] | None:
        return getattr(self.model, "feature_names_in_", None) or self._feature_schema

    def predict(self, features: dict | list) -> list[dict]:
        ordered = _order_features(features, self.feature_names)
        with self._torch.no_grad():
            tensor = self._torch.tensor([ordered], dtype=self._torch.float32)
            out = self.model(tensor)
        return _normalize_tensor_like(out)


class OnnxAdapter(ModelAdapter):
    model_name = "OnnxModel"

    def __init__(self, path: str, feature_schema: list[str] | None = None):
        import onnxruntime as ort
        self._sess = ort.InferenceSession(path)
        self._feature_schema = feature_schema

    @property
    def feature_names(self) -> list[str] | None:
        names = []
        for inp in self._sess.get_inputs():
            names.extend(inp.name.split(",") if "," in inp.name else [inp.name])
        return names or self._feature_schema

    def predict(self, features: dict | list) -> list[dict]:
        import numpy as np
        ordered = _order_features(features, self.feature_names)
        inp = {self._sess.get_inputs()[0].name: np.array([ordered], dtype=np.float32)}
        raw = self._sess.run(None, inp)
        arr = _to_numpy(raw[0][0]) if raw else _to_numpy([0.0])
        arr = _maybe_softmax(_to_numpy(arr).reshape(-1))
        return [{"label": f"class_{i}", "score": float(p), "raw": {"proba": float(p)}} for i, p in enumerate(arr)]


class KerasAdapter(ModelAdapter):
    def __init__(self, path: str, feature_schema: list[str] | None = None):
        from tensorflow import keras
        self.model = keras.models.load_model(path)  # type: ignore
        self._feature_schema = feature_schema

    @property
    def model_name(self) -> str:
        return self.model.name or "KerasModel"

    @property
    def feature_names(self) -> list[str] | None:
        return getattr(self.model, "feature_names_in_", None) or self._feature_schema

    def predict(self, features: dict | list) -> list[dict]:
        import numpy as np
        ordered = _order_features(features, self.feature_names)
        preds = self.model.predict(np.array([ordered], dtype=np.float32), verbose=0)[0]
        return _normalize_tensor_like(preds)
