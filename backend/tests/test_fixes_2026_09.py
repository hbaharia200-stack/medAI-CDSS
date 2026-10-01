"""Tests for the fixes in this task.

Covers:
  * the patient intake round-trip bug (sex normalisation);
  * doctor availability persistence across refresh + logout/login;
  * public contact messages (persistence, validation, staff visibility, and
    their separation from the clinical staff chat);
  * doctor-side AI decision support (provider path, safety rules, fail-closed).
"""
from __future__ import annotations

import datetime

import pytest

from app.extensions import db
from app.models import ContactMessage, DoctorProfile
from app.services.ai import reset_provider_cache
from app.services.ai.decision_support import (
    AIDecisionSupportError,
    generate_decision_support,
)
from app.services.ai.provider import AIProvider, AIProviderError, AgentProviderRequest
from tests.conftest import auth_headers, login, register


# ---------------------------------------------------------------------------
# C. Patient intake round-trip
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("M", "M"), ("m", "M"), ("Male", "M"), ("MALE", "M"), ("male", "M"),
    ("F", "F"), ("f", "F"), ("Female", "F"), ("FEMALE", "F"),
])
def test_sex_labels_normalise_to_canonical(raw, expected, client, patient):
    """A UI that sends a *label* instead of a code must not be rejected."""
    resp = client.post(
        "/api/cases",
        headers=patient["headers"],
        json={
            "chiefComplaint": "Headache",
            "symptoms": [{"label": "headache"}],
            "intake": {
                "name": "Grace Patient", "age": 30, "sex": raw,
                "phone": "+255700000001", "language": "en",
            },
        },
    )
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()["data"]["patient"]["sex"] == expected


def test_registration_stores_canonical_sex_and_intake_accepts_it(client):
    """The regression itself: a value written by /register must be readable by
    /cases, which is what previously produced 422 invalid_sex on submit."""
    resp = register(client, {
        "role": "patient", "name": "Round Trip", "phone": "+255700000042",
        "password": "S3curePass!", "age": 88, "sex": "Male",
    })
    assert resp.status_code == 201
    assert resp.get_json()["user"]["sex"] == "M"  # canonical, not "MALE"

    resp = login(client, {"role": "patient", "identifier": "+255700000042",
                          "password": "S3curePass!"})
    resp = client.post("/api/cases", headers=auth_headers(resp), json={
        "chiefComplaint": "kichwa",
        "symptoms": [{"label": "kichwa"}],
        "intake": {"name": "Round Trip", "age": 88, "sex": "M",
                   "phone": "+255700000042", "language": "en"},
    })
    assert resp.status_code == 201, resp.get_json()


def test_genuinely_invalid_sex_is_still_rejected(client, patient):
    resp = client.post("/api/cases", headers=patient["headers"], json={
        "chiefComplaint": "x", "symptoms": [{"label": "x"}],
        "intake": {"name": "Grace Patient", "age": 30, "sex": "banana",
                   "phone": "+255700000001", "language": "en"},
    })
    assert resp.status_code == 422
    assert resp.get_json()["error"] == "invalid_sex"


def test_registration_rejects_non_numeric_age(client):
    resp = register(client, {
        "role": "patient", "name": "Bad Age", "phone": "+255700000099",
        "password": "S3curePass!", "age": "eighty", "sex": "F",
    })
    assert resp.status_code == 422
    assert resp.get_json()["error"] == "invalid_age"


# ---------------------------------------------------------------------------
# F. Doctor availability
# ---------------------------------------------------------------------------

def test_availability_defaults_to_available(client, doctor):
    resp = client.get("/api/auth/me/availability", headers=doctor["headers"])
    assert resp.status_code == 200
    assert resp.get_json()["data"]["availability"] == "available"


@pytest.mark.parametrize("value", ["not_available", "available"])
def test_availability_persists_across_refresh_and_relogin(client, doctor, value):
    resp = client.patch("/api/auth/me/availability", headers=doctor["headers"],
                        json={"availability": value})
    assert resp.status_code == 200
    assert resp.get_json()["data"]["availability"] == value

    # Refresh: same session, re-read from the backend.
    resp = client.get("/api/auth/me/availability", headers=doctor["headers"])
    assert resp.get_json()["data"]["availability"] == value

    # Logout/login: brand new token, value must still be there.
    body = client.get("/api/auth/me", headers=doctor["headers"]).get_json()["user"]
    fresh = login(client, {"role": "doctor", "staffId": "DOC-001"})
    resp = client.get("/api/auth/me/availability", headers=auth_headers(fresh))
    assert resp.get_json()["data"]["availability"] == value
    assert body["availability"] == value


def test_availability_is_stored_in_the_database(client, doctor):
    client.patch("/api/auth/me/availability", headers=doctor["headers"],
                 json={"availability": "not_available"})
    profile = db.session.get(DoctorProfile, doctor["id"])
    assert profile.is_available is False
    assert profile.availability == "not_available"


def test_availability_rejects_unknown_value(client, doctor):
    resp = client.patch("/api/auth/me/availability", headers=doctor["headers"],
                        json={"availability": "perhaps"})
    assert resp.status_code == 422
    assert resp.get_json()["error"] == "invalid_availability"


def test_patient_cannot_set_availability(client, patient):
    resp = client.patch("/api/auth/me/availability", headers=patient["headers"],
                        json={"availability": "available"})
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# I. Public contact messages
# ---------------------------------------------------------------------------

def test_public_contact_message_is_persisted(client, doctor):
    """The landing-page form previously only flipped local React state."""
    resp = client.post("/api/contact-messages", json={
        "name": "Neema Visitor",
        "message": "I would like to book a consultation for my mother.",
    })
    assert resp.status_code == 201, resp.get_json()
    saved = resp.get_json()["data"]
    assert saved["name"] == "Neema Visitor"
    assert saved["status"] == "new"
    assert saved["source"] == "website_contact_form"

    # Really in the database, and visible to staff.
    assert db.session.get(ContactMessage, saved["id"]) is not None
    listing = client.get("/api/contact-messages", headers=doctor["headers"])
    assert listing.status_code == 200
    assert any(m["name"] == "Neema Visitor" for m in listing.get_json()["data"])


def test_contact_message_survives_a_reload(client, doctor):
    client.post("/api/contact-messages",
                json={"name": "Persist Check", "message": "Still here?"})
    first = client.get("/api/contact-messages", headers=doctor["headers"]).get_json()
    second = client.get("/api/contact-messages", headers=doctor["headers"]).get_json()
    assert first["data"] == second["data"]


@pytest.mark.parametrize("payload,code", [
    ({"name": "", "message": "hi"}, "required_field_missing"),
    ({"name": "A", "message": "   "}, "required_field_missing"),
    ({"message": "hi"}, "required_field_missing"),
    ({"name": "A", "message": "<script>alert(1)</script>"}, "unsafe_content"),
    ({"name": "<img src=x onerror=alert(1)>", "message": "hi"}, "unsafe_content"),
])
def test_contact_message_rejects_bad_input(client, payload, code):
    resp = client.post("/api/contact-messages", json=payload)
    assert resp.status_code == 422
    assert resp.get_json()["error"] == code


def test_contact_message_rejects_excessive_length(client):
    resp = client.post("/api/contact-messages", json={
        "name": "A", "message": "x" * 5000,
    })
    assert resp.status_code == 422
    assert resp.get_json()["error"] == "field_too_long"


def test_patient_cannot_read_contact_messages(client, patient):
    resp = client.get("/api/contact-messages", headers=patient["headers"])
    assert resp.status_code == 403


def test_contact_messages_require_authentication(client):
    assert client.get("/api/contact-messages").status_code in (401, 422)


def test_staff_can_mark_a_message_read(client, doctor):
    created = client.post("/api/contact-messages",
                          json={"name": "Reader", "message": "Please call me."}).get_json()["data"]
    resp = client.patch(f"/api/contact-messages/{created['id']}",
                        headers=doctor["headers"], json={"status": "read"})
    assert resp.status_code == 200
    body = resp.get_json()["data"]
    assert body["status"] == "read"
    assert body["readAt"] is not None


def test_contact_messages_are_not_mixed_into_the_clinical_chat(client, doctor, nurse):
    """Public enquiries must never appear as staff chat messages."""
    client.post("/api/contact-messages", json={"name": "Visitor", "message": "Hello"})

    room = client.post("/api/chat-rooms", headers=doctor["headers"],
                       json={"name": "Clinical", "participantIds": [nurse["id"]]})
    assert room.status_code == 201
    client.post("/api/messages", headers=doctor["headers"],
                json={"roomId": room.get_json()["data"]["id"], "body": "Real clinical note"})

    listed = client.get(f"/api/messages?roomId={room.get_json()['data']['id']}",
                        headers=doctor["headers"]).get_json()["data"]
    assert [m["body"] for m in listed] == ["Real clinical note"]
    assert db.session.query(ContactMessage).count() == 1


# ---------------------------------------------------------------------------
# E. Doctor-side AI decision support
# ---------------------------------------------------------------------------

class _StubProvider(AIProvider):
    """Standalone provider stub used to validate the decision-support path."""

    name = "stub"
    model = "stub-model"

    def __init__(self, reply: str):
        self.reply = reply
        self.requests: list[AgentProviderRequest] = []

    def available(self):
        return True, None

    def generate(self, request: AgentProviderRequest) -> str:
        self.requests.append(request)
        return self.reply


class _BrokenProvider(AIProvider):
    name = "broken"
    model = "broken-model"

    def available(self):
        return True, None

    def generate(self, request):
        raise AIProviderError(AIProviderError.TIMEOUT, "The AI provider did not respond in time.")


def test_decision_support_is_structured_and_labelled_as_ai_assisted():
    provider = _StubProvider(
        '{"conditions":[{"name":"Malaria","confidence":72,'
        '"rationale":"Fever reported for 3 days."},'
        '{"name":"Typhoid fever","confidence":40,"rationale":"Prolonged fever."}],'
        '"suggestedTests":["Malaria rapid test","Blood culture"]}'
    )
    result = generate_decision_support(provider, {
        "chiefComplaint": "Fever and cough",
        "symptoms": [{"label": "fever", "severity": 3, "durationDays": 3}],
        "patient": {"age": 30, "sex": "F"},
    })
    assert result["label"] == "AI-assisted suggestion"
    assert "final clinical decision is made by the doctor" in result["disclaimer"]
    assert [c["name"] for c in result["conditions"]] == ["Malaria", "Typhoid fever"]
    assert result["conditions"][0]["confidencePercent"] == 72
    assert [t["name"] for t in result["suggestedTests"]] == ["Malaria rapid test", "Blood culture"]


def test_decision_support_drops_prescribing_content():
    """A provider that prescribes must have that content removed."""
    provider = _StubProvider(
        '{"conditions":[{"name":"Malaria","confidence":70,"rationale":"Fever.",'
        '"extra":"Start artemether 20mg twice daily"}],'
        '"suggestedTests":["Malaria rapid test","amoxicillin 500mg"]}'
    )
    result = generate_decision_support(provider, {
        "chiefComplaint": "Fever", "symptoms": [{"label": "fever"}],
    })
    assert all("mg" not in t["name"].lower() for t in result["suggestedTests"])
    assert all("mg" not in c["name"].lower() for c in result["conditions"])


def test_decision_support_requires_a_confidence_percentage():
    """No confidence -> the condition is dropped, not given an invented score."""
    provider = _StubProvider('{"conditions":[{"name":"Malaria","rationale":"Fever."}]}')
    with pytest.raises(AIDecisionSupportError):
        generate_decision_support(provider, {
            "chiefComplaint": "Fever", "symptoms": [{"label": "fever"}],
        })


def test_decision_support_never_forwards_invented_vitals():
    provider = _StubProvider('{"conditions":[{"name":"Malaria","confidence":70}]}')
    generate_decision_support(provider, {
        "chiefComplaint": "Fever", "symptoms": [{"label": "fever"}], "vitals": None,
    })
    prompt = provider.requests[0].user_prompt
    assert "recordedVitals" not in prompt  # nothing recorded -> nothing claimed


def test_decision_support_fails_closed_when_provider_errors():
    with pytest.raises(AIDecisionSupportError) as excinfo:
        generate_decision_support(_BrokenProvider(), {"chiefComplaint": "Fever"})
    assert excinfo.value.reason == AIProviderError.TIMEOUT


def test_decision_support_rejects_non_json():
    provider = _StubProvider("I am not JSON at all.")
    with pytest.raises(AIDecisionSupportError):
        generate_decision_support(provider, {"chiefComplaint": "Fever"})


def test_decision_support_endpoint_fails_closed_without_a_provider(client, doctor, open_case):
    """No artifact and no provider -> 503, nothing stored (unchanged contract)."""
    resp = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                       headers=doctor["headers"])
    assert resp.status_code == 503
    assert "model" in resp.get_json()["message"].lower()
    listed = client.get(f"/api/cases/{open_case['id']}/recommendations",
                        headers=doctor["headers"])
    assert listed.get_json()["data"] == []


def test_ai_recommendation_persists_provider_decision_support(app, client, doctor, open_case):
    """With a provider configured, a real recommendation is stored and shown."""
    provider = _StubProvider(
        '{"conditions":[{"name":"Malaria","confidence":78,"rationale":"Fever 3 days."}],'
        '"suggestedTests":["Malaria rapid test"]}'
    )
    previous = app.config.get("AI_PROVIDER")
    import app.services.ai as ai_layer

    app.config["AI_PROVIDER"] = "stub"
    reset_provider_cache()
    # Seed the provider cache under the key the registry will look up, so the
    # real network path is never touched by the test suite.
    ai_layer._CACHE[ai_layer._cache_key("stub")] = provider
    try:
        resp = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                           headers=doctor["headers"])
        assert resp.status_code == 201, resp.get_json()
        created = resp.get_json()["data"]
        assert created[0]["diseaseName"] == "Malaria"

        stored = client.get(f"/api/cases/{open_case['id']}/recommendations",
                            headers=doctor["headers"]).get_json()["data"]
        assert len(stored) == 1
        assert stored[0]["diseaseName"] == "Malaria"
        # The AI-assisted label is present in what the doctor sees.
        assert any("AI-assisted suggestion" in r for r in stored[0]["reasoningFactors"])
    finally:
        reset_provider_cache()
        app.config["AI_PROVIDER"] = previous


# ---------------------------------------------------------------------------
# G. Appointment counts must agree with the rows the dashboards render
# ---------------------------------------------------------------------------

def test_public_booking_is_visible_to_a_doctor_today(client, doctor):
    """A booking made without choosing a doctor is persisted but has
    doctor_id IS NULL, so a doctor-scoped query must still include it."""
    today = datetime.date.today().isoformat()
    created = client.post("/api/appointments", json={
        "patientName": "Salva John Sanga", "phone": "+255711223399",
        "preferredDate": today, "preferredTime": "10:30",
        "reason": "General consultation",
    })
    assert created.status_code == 201, created.get_json()
    appointment_id = created.get_json()["id"]

    listed = client.get(f"/api/appointments?date={today}", headers=doctor["headers"])
    assert listed.status_code == 200
    ids = [row["id"] for row in listed.get_json()["data"]]
    assert appointment_id in ids


def test_today_counts_match_the_rows_returned_for_the_doctor(client, doctor):
    """The regression: /appointments/today filtered on doctor_id only, so a
    public booking (doctor_id NULL) was persisted but counted as zero."""
    today = datetime.date.today().isoformat()
    client.post("/api/appointments", json={
        "patientName": "Count Check", "phone": "+255700000777",
        "preferredDate": today, "preferredTime": "09:15",
    })

    rows = client.get(f"/api/appointments?date={today}", headers=doctor["headers"]).get_json()["data"]
    summary = client.get("/api/appointments/today", headers=doctor["headers"]).get_json()["data"]

    assert summary["date"] == today
    counted = sum(summary["counts"].values())
    assert counted == len(rows), f"counts={summary['counts']} rows={len(rows)}"
    assert summary["counts"].get("pending", 0) >= 1


def test_appointment_fees_are_not_invented(client, doctor):
    """No configured price -> the API reports 0/None so the UI can omit it."""
    today = datetime.date.today().isoformat()
    client.post("/api/appointments", json={
        "patientName": "No Fee", "phone": "+255700000778",
        "preferredDate": today, "preferredTime": "11:45",
    })
    rows = client.get(f"/api/appointments?date={today}", headers=doctor["headers"]).get_json()["data"]
    assert all((row["fees"] or 0) == 0 for row in rows)


