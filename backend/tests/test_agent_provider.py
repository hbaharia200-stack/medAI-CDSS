"""Regression tests for the agent AI provider boundary.

The backend intentionally starts with no provider configured. The tests below
exercise the fail-closed contract: no provider, unknown provider, or provider
failure must never fabricate clinical content or leak secrets.
"""
from __future__ import annotations

import json

import pytest

from app.services import ai as ai_layer
from app.services.ai.provider import AIProvider, AIProviderError, AgentProviderRequest
from tests.conftest import auth_headers, login, register


class StubProvider(AIProvider):
    """Minimal provider stub used to validate the generic AI contract."""

    name = "stub"

    def __init__(self, *, reply: str = '{"reply": "ok"}', error: Exception | None = None):
        self.reply = reply
        self.error = error

    def available(self) -> tuple[bool, str | None]:
        if self.error is not None:
            if isinstance(self.error, AIProviderError):
                return False, self.error.reason
            return False, AIProviderError.NOT_CONFIGURED
        return True, None

    def generate(self, request: AgentProviderRequest) -> str:
        if self.error is not None:
            raise self.error
        return self.reply


@pytest.fixture(autouse=True)
def _clear_provider_cache():
    ai_layer.reset_provider_cache()
    yield
    ai_layer.reset_provider_cache()


def _set_stub_provider(app, provider: AIProvider):
    app.config["AI_PROVIDER"] = provider.name
    ai_layer._CACHE[ai_layer._cache_key(provider.name)] = provider


def _submit_case(client, patient):
    resp = client.post(
        "/api/cases",
        headers=patient["headers"],
        json={
            "chiefComplaint": "Headache",
            "patientId": patient["id"],
            "symptoms": [{"label": "Headache", "severity": 4}],
        },
    )
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["data"]


def test_no_provider_is_unavailable(app, client, patient):
    app.config["AI_PROVIDER"] = ""
    resp = client.post("/api/agent/chat", headers=patient["headers"], json={"message": "hi"})
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()["data"]
    assert data["status"] == "model_unavailable"
    assert data["providerStatus"] == "provider_not_configured"


def test_unknown_provider_name_is_controlled(app, client, patient):
    app.config["AI_PROVIDER"] = "definitely-not-a-provider"
    data = client.post("/api/agent/chat", headers=patient["headers"], json={"message": "hi"}).get_json()["data"]
    assert data["status"] == "model_unavailable"
    assert data["providerStatus"] == "provider_not_configured"


def test_teammate_provider_is_explicitly_not_implemented(app, client, patient):
    app.config["AI_PROVIDER"] = "teammate"
    data = client.post("/api/agent/chat", headers=patient["headers"], json={"message": "hi"}).get_json()["data"]
    assert data["status"] == "model_unavailable"
    assert data["providerStatus"] == "provider_not_configured"


@pytest.mark.parametrize(
    "content",
    [
        "this is just prose, not JSON",
        "[]",
        '{"unexpected": "shape"}',
        '{"reply": ""}',
        '{"reply": 42}',
    ],
)
def test_invalid_provider_output_is_controlled(app, client, patient, content):
    _set_stub_provider(app, StubProvider(reply=content))
    resp = client.post("/api/agent/chat", headers=patient["headers"], json={"message": "hi"})
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()["data"]
    assert data["status"] == "model_unavailable"
    assert data["providerStatus"] == "provider_invalid_response"
    assert content not in data["reply"]


def test_provider_failure_is_controlled(app, client, patient):
    _set_stub_provider(app, StubProvider(error=AIProviderError(AIProviderError.TIMEOUT, "timed out")))
    resp = client.post("/api/agent/chat", headers=patient["headers"], json={"message": "hi"})
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()["data"]
    assert data["status"] == "model_unavailable"
    assert data["providerStatus"] == "provider_timeout"


def test_server_owns_the_disclaimer_and_safety_filters(app, client, patient):
    from app.services.ai.prompting import DISCLAIMER

    _set_stub_provider(
        app,
        StubProvider(
            reply=json.dumps(
                {
                    "reply": "See a clinician.",
                    "disclaimer": "This is definitely a confirmed diagnosis.",
                    "labResults": [{"test": "Malaria", "result": "positive"}],
                    "prescription": "Artemether",
                    "possibleConditions": [{"displayName": "Tension headache", "confidencePercent": 50}],
                }
            )
        ),
    )
    data = client.post("/api/agent/chat", headers=patient["headers"], json={"message": "hi"}).get_json()["data"]
    assert data["disclaimer"] == DISCLAIMER
    assert "confirmed diagnosis" not in data["disclaimer"]
    assert "labResults" not in data
    assert "prescription" not in data
    assert data["possibleConditions"][0]["displayName"] == "Tension headache"


def test_red_flag_symptom_appends_deterministic_escalation(app, client, patient):
    from app.services.ai.prompting import ESCALATION

    _set_stub_provider(app, StubProvider(reply='{"reply": "That sounds uncomfortable."}'))
    data = client.post(
        "/api/agent/chat",
        headers=patient["headers"],
        json={"message": "I have chest pain and cannot breathe"},
    ).get_json()["data"]
    assert data["emergency"] is True
    assert ESCALATION in data["reply"]
    assert "find_hospital" in data["actions"]


def test_agent_chat_still_requires_authentication(app, client):
    _set_stub_provider(app, StubProvider(reply='{"reply": "ok"}'))
    assert client.post("/api/agent/chat", json={"message": "hi"}).status_code == 401


def test_staff_still_cannot_use_the_patient_agent(app, client, doctor):
    _set_stub_provider(app, StubProvider(reply='{"reply": "ok"}'))
    resp = client.post("/api/agent/chat", headers=doctor["headers"], json={"message": "hi"})
    assert resp.status_code == 403


def test_patient_still_cannot_use_another_patients_case(app, client, patient):
    from tests.conftest import PATIENT as OTHER

    _set_stub_provider(app, StubProvider(reply='{"reply": "ok"}'))
    case = _submit_case(client, patient)
    register(client, {**OTHER, "phone": "+255700000077", "email": "other-ai@example.com"})
    other = login(client, {"role": "patient", "identifier": "+255700000077", "password": OTHER["password"]})
    resp = client.post(
        "/api/agent/chat",
        headers=auth_headers(other),
        json={"message": "show me their case", "caseId": case["id"]},
    )
    assert resp.status_code == 403


def test_provider_reply_is_persisted_to_history(app, client, patient):
    _set_stub_provider(app, StubProvider(reply='{"reply": "Please rest and see a nurse today."}'))
    client.post("/api/agent/chat", headers=patient["headers"], json={"message": "slight headache"})
    history = client.get("/api/agent/history", headers=patient["headers"]).get_json()["data"]
    assert [m["role"] for m in history] == ["patient", "assistant"]
    assert history[1]["text"] == "Please rest and see a nurse today."


def test_failed_provider_call_still_persists_the_controlled_reply(app, client, patient):
    _set_stub_provider(app, StubProvider(error=AIProviderError(AIProviderError.UNAVAILABLE, "down")))
    client.post("/api/agent/chat", headers=patient["headers"], json={"message": "hi"})
    history = client.get("/api/agent/history", headers=patient["headers"]).get_json()["data"]
    assert history[1]["text"] == "Clinical AI analysis is not available yet."


def test_non_agent_endpoints_are_untouched(app, client, patient, doctor):
    _set_stub_provider(app, StubProvider(reply='{"reply": "ok"}'))
    case = _submit_case(client, patient)
    assert client.get(f"/api/cases/{case['id']}", headers=doctor["headers"]).status_code == 200
    assert client.get("/api/cases/queue", headers=doctor["headers"]).status_code == 200
    assert client.get("/api/dashboard/basic", headers=doctor["headers"]).status_code == 200
    assert client.get("/api/auth/me", headers=patient["headers"]).status_code == 200


def test_unavailable_state_is_localized_for_patient(app, client, patient):
    app.config["AI_PROVIDER"] = ""
    data = client.post("/api/agent/chat", headers=patient["headers"], json={"message": "hi", "language": "sw"}).get_json()["data"]
    assert data["status"] == "model_unavailable"
    assert "Uchambuzi wa AI za kliniki" in data["reply"]
