"""AI service layer tests.

The real trained artifact is not shipped in the repository, so:

* with no ``AI_MODEL_PATH`` configured the API answers 503 (never a fake
  prediction), and
* with a real sklearn artifact supplied through dependency injection the full
  inference path (feature building -> adapter -> normalization) is exercised
  end-to-end.
"""
from __future__ import annotations

import numpy as np
import pytest
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from app.ai import AIModelNotConfigured, build_case_features
from app.extensions import db
from tests.conftest import DOCTOR, auth_headers, register


def test_predict_503_without_artifact(client, doctor, nurse, open_case):
    # Vitals first so the feature payload is complete.
    client.post(f"/api/cases/{open_case['id']}/vitals", headers=nurse["headers"],
                json={"temperatureC": 38.9, "heartRate": 100})
    resp = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                       headers=doctor["headers"])
    assert resp.status_code == 503
    body = resp.get_json()
    assert body["success"] is False
    assert "AI_MODEL_PATH" in body["message"] or "artifact" in body["message"].lower()


def test_doctor_role_required_for_ai(client, nurse, open_case):
    resp = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                       headers=nurse["headers"])
    assert resp.status_code == 403


def test_patient_role_forbidden_for_ai(client, patient, open_case):
    resp = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                       headers=patient["headers"])
    assert resp.status_code == 403


def test_feature_engine_builds_named_floats(client, patient, open_case):
    case = client.get(f"/api/cases/{open_case['id']}", headers=patient["headers"])
    payload = case.get_json()["data"]
    features = build_case_features(payload)
    assert all(isinstance(v, float) for v in features.values())
    assert features["symptom_fever"] == 1.0
    assert features["symptom_cough"] == 1.0
    assert features["symptom_max_severity"] == 3.0
    assert features["symptom_count"] == 2.0
    assert features["history_count"] == 1.0


class _TrainedMalariaModel:
    """A real sklearn model trained inline on synthetic malaria-like data.

    This stands in for the modelling teammate's artifact: it is trained (not
    faked), persisted to disk with joblib, loaded through the production
    ``SklearnAdapter`` and executed through the production ``AIService``.
    """

    def __init__(self, path: str):
        rng = np.random.default_rng(42)
        n = 400
        fever = rng.integers(0, 2, n)
        headache = rng.integers(0, 2, n)
        temp = rng.normal(37.2, 1.2, n)
        hr = rng.normal(84, 12, n)
        spo2 = rng.normal(97, 2, n)
        X = np.column_stack([fever, headache, temp, hr, spo2,
                             rng.normal(0, 1, (n, 6))])  # noise columns
        # Malaria when fever + high temp.
        y = ((fever == 1) & (temp > 37.8)).astype(int)
        scaler = StandardScaler().fit(X)
        self.clf = LogisticRegression(max_iter=1000).fit(scaler.transform(X), y)
        self.scaler = scaler
        self.feature_names_in_ = np.array(
            ["symptom_fever", "symptom_headache", "vital_temperature_c",
             "vital_heart_rate", "vital_spo2", "n1", "n2", "n3", "n4", "n5", "n6"]
        )

    def predict(self, X):
        return self.clf.predict(self.scaler.transform(X))

    def predict_proba(self, X):
        return self.clf.predict_proba(self.scaler.transform(X))


def _install_model(client, tmp_path) -> str:
    import joblib

    from app.services import ai_service

    model_path = str(tmp_path / "malaria_model.joblib")
    joblib.dump(_TrainedMalariaModel(model_path), model_path)
    client.application.config["AI_MODEL_PATH"] = model_path
    client.application.config["AI_FEATURE_SCHEMA_PATH"] = ""
    ai_service._CACHE.clear()
    return model_path


@pytest.fixture()
def stub_model(client, tmp_path):
    _install_model(client, tmp_path)
    yield
    from app.services import ai_service

    ai_service._CACHE.clear()


# ---------------------------------------------------------------------------
# Full real-artifact path through the HTTP API
# ---------------------------------------------------------------------------


def test_real_sklearn_artifact_end_to_end(tmp_path, client, doctor, nurse, open_case):
    """Full path: train artifact -> joblib -> adapter -> AIService -> HTTP 201."""
    import joblib

    from app.services import ai_service

    model_path = str(tmp_path / "malaria_model.joblib")
    joblib.dump(_TrainedMalariaModel(model_path), model_path)

    client.application.config["AI_MODEL_PATH"] = model_path
    client.application.config["AI_FEATURE_SCHEMA_PATH"] = ""
    ai_service._CACHE.clear()  # fresh load for this artifact

    try:
        # Vitals first so the feature payload is complete.
        client.post(f"/api/cases/{open_case['id']}/vitals", headers=nurse["headers"],
                    json={"temperatureC": 39.1, "heartRate": 104, "oxygenSaturation": 96})

        resp = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                           headers=doctor["headers"])
        assert resp.status_code == 201, resp.get_json()
        recs = resp.get_json()["data"]
        assert recs, "expected at least one normalized recommendation"

        top = recs[0]
        # Normalized frontend contract (shared-types/caseTypes.ts).
        assert top["diseaseName"]
        assert top["confidence"] in {"High", "Medium", "Low"}
        assert 0.0 <= top["confidenceScore"] <= 1.0
        assert isinstance(top["reasoningFactors"], list) and top["reasoningFactors"]
        assert isinstance(top["recommendedTests"], list)
        assert "_raw" not in top and "_model_version" not in top

        # Recommendations are persisted against the case.
        listed = client.get(f"/api/cases/{open_case['id']}/ai-recommendation",
                            headers=doctor["headers"])
        assert listed.status_code == 200
        stored = listed.get_json()["data"]
        assert stored and stored[0]["id"] == top["id"]
    finally:
        ai_service._CACHE.clear()


# ---------------------------------------------------------------------------
# Adapter / unit level
# ---------------------------------------------------------------------------


def test_adapter_uses_declared_feature_names(tmp_path):
    """Features are ordered by the artifact's own feature_names_in_ — no guessing."""
    import joblib

    from app.ai.adapters import SklearnAdapter

    model_path = str(tmp_path / "m.joblib")
    joblib.dump(_TrainedMalariaModel(model_path), model_path)
    adapter = SklearnAdapter(model_path)

    names = adapter.feature_names
    assert names is not None and names[0] == "symptom_fever"

    # A feature dict in ANY order is mapped onto the declared names.
    from app.ai.adapters import _order_features

    features = {n: float(i) for i, n in enumerate(names)}
    x = _order_features(features, names)
    assert x == [float(i) for i in range(len(names))]

    # Missing model features become 0.0 (explicit, documented behaviour).
    partial = {names[0]: 1.0}
    x = adapter._order_features(partial, names)
    assert x[0] == 1.0 and x[1] == 0.0

    preds = adapter.predict(partial)
    assert preds and {"label", "score"} <= set(preds[0].keys())
    total = sum(p["score"] for p in preds)
    assert abs(total - 1.0) < 1e-6  # probabilities sum to 1


def test_feature_engine_maps_case_to_named_features():
    features = build_case_features({
        "patient": {"age": 34, "sex": "F"},
        "symptoms": [{"label": "fever", "severity": 4}, {"label": "headache", "severity": 2}],
        "vitals": {"temperatureC": 38.9, "heartRate": 104},
        "history": ["Asthma"],
        "urgent": True,
    })
    assert features["age"] == 34.0
    assert features["sex_male"] == 0.0 and features["sex_female"] == 1.0
    assert features["vital_temperature_c"] == 38.9
    assert features["symptom_fever"] == 1.0
    assert features["symptom_max_severity"] == 4.0
    assert features["symptom_count"] == 2.0
    assert features["urgent_flag"] == 1.0
    assert features["history_count"] == 1.0


def test_normalizer_shapes_frontend_contract(client, stub_model):
    from app.services import ai_service

    recs = ai_service.predict({
        "patient": {"age": 30, "sex": "F"},
        "symptoms": [{"label": "fever", "severity": 3}],
        "vitals": {},
        "history": [],
    })
    assert recs and len(recs) <= 3
    top = recs[0]
    assert top["diseaseName"]
    assert top["confidence"] in {"High", "Medium", "Low"}
    assert 0 <= top["confidenceScore"] <= 1
    assert isinstance(top["reasoningFactors"], list) and top["reasoningFactors"]
    assert isinstance(top["recommendedTests"], list)
    # internal provenance keys survive for persistence
    assert "_raw" in top and "_model_version" in top
    # but are stripped for the client payload
    client_payload = ai_service.predict_for_client({
        "patient": {"age": 30, "sex": "F"},
        "symptoms": [{"label": "fever", "severity": 3}],
        "vitals": {},
        "history": [],
    })[0]
    assert "_raw" not in client_payload and "_model_version" not in client_payload


def test_predict_without_model_is_never_faked():
    # AI_MODEL_PATH is cleared in the testing config: the honest failure path.
    from app.services import ai_service

    with pytest.raises(AIModelNotConfigured):
        ai_service.predict({"patient": {}, "symptoms": [], "vitals": {}, "history": []})


# ---------------------------------------------------------------------------
# Endpoint: POST /api/cases/<id>/ai-recommendation
# ---------------------------------------------------------------------------


def test_ai_recommendation_endpoint_flow(client, doctor, open_case, stub_model):
    generated = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                            headers=doctor["headers"])
    assert generated.status_code == 201, generated.get_json()
    recs = generated.get_json()["data"]
    assert recs and recs[0]["diseaseName"]
    assert "confidenceScore" in recs[0]

    listed = client.get(f"/api/cases/{open_case['id']}/ai-recommendation",
                        headers=doctor["headers"])
    assert listed.status_code == 200
    saved = listed.get_json()["data"]
    assert saved[0]["id"] and saved[0]["diseaseName"] == recs[0]["diseaseName"]


def test_ai_health_reports_unconfigured_honestly(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["success"] is True
    assert body["data"]["ai"]["configured"] is False


def test_missing_artifact_path_raises_not_configured():
    from app.services import ai_service

    with pytest.raises(AIModelNotConfigured):
        ai_service.get_adapter()

