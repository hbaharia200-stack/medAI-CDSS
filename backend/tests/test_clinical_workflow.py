"""The core clinical workflow:

patient opens a case -> staff queue -> nurse vitals -> doctor view ->
AI request (503 while no artifact is configured — never faked) ->
diagnosis -> confirmed diagnosis completes the case ->
recommended tests assigned to the nurse -> nurse acknowledges/completes.
"""
import pytest

from tests.conftest import auth_headers, login, register  # noqa: E402
from tests.test_ai_service import _TrainedMalariaModel  # noqa: E402


def test_patient_creates_case_and_sees_it(client, patient, open_case):
    assert open_case["chiefComplaint"].startswith("Fever")
    assert len(open_case["symptoms"]) == 2

    listed = client.get("/api/cases", headers=patient["headers"])
    assert listed.status_code == 200
    items = listed.get_json()["data"]
    assert any(c["id"] == open_case["id"] for c in items)


def test_patient_case_persists_location_and_follow_up_answers(client, patient):
    response = client.post(
        "/api/cases",
        headers=patient["headers"],
        json={
            "chiefComplaint": "Headache",
            "symptoms": [{"label": "headache", "severity": 2}],
            "followUpAnswers": [{"questionId": "q1", "question": "Fever?", "answer": False}],
            "location": {"latitude": -6.8, "longitude": 39.28, "capturedAt": "2026-09-25T10:00:00Z"},
        },
    )
    assert response.status_code == 201, response.get_json()
    payload = response.get_json()["data"]
    assert payload["status"] == "submitted"
    assert payload["location"]["latitude"] == -6.8
    assert payload["followUpAnswers"][0]["answer"] is False


def test_old_case_without_location_remains_readable(client, patient, open_case):
    assert open_case.get("location") is None
    assert open_case["followUpAnswers"] == []


def test_patient_agent_returns_explicit_model_unavailable_state(client, patient, open_case):
    response = client.post(
        "/api/agent/chat",
        headers=patient["headers"],
        json={"message": "I have a headache again.", "caseId": open_case["id"]},
    )
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["status"] == "model_unavailable"
    assert "diagnos" not in data["reply"].lower()


def test_patient_agent_cannot_read_another_patients_case(client, patient, open_case):
    from tests.conftest import PATIENT as OTHER

    register(client, {**OTHER, "phone": "+255700000099", "email": "other-agent@example.com"})
    other = login(client, {"role": "patient", "identifier": "+255700000099", "password": OTHER["password"]})
    response = client.post(
        "/api/agent/chat",
        headers=auth_headers(other),
        json={"message": "Show my case", "caseId": open_case["id"]},
    )
    assert response.status_code == 403


def test_case_requires_chief_complaint(client, patient):
    resp = client.post("/api/cases", headers=patient["headers"], json={"symptoms": []})
    assert resp.status_code == 422


def test_patient_cannot_read_another_patients_case(client, patient, open_case):
    from tests.conftest import PATIENT as OTHER

    register(client, {**OTHER, "phone": "+255700000009", "email": "other@example.com"})
    other = login(client, {"role": "patient", "identifier": "+255700000009",
                           "password": OTHER["password"]})
    resp = client.get(f"/api/cases/{open_case['id']}", headers=auth_headers(other))
    assert resp.status_code == 403


def test_nurse_queue_and_vitals_flow(client, nurse, open_case):
    queue = client.get("/api/cases/queue", headers=nurse["headers"])
    assert queue.status_code == 200
    # Queue returns QueueCase[]: {case: {...}, arrivalOrder: idx}
    queue_data = queue.get_json()["data"]
    assert any(c["case"]["id"] == open_case["id"] for c in queue_data)

    vitals = client.post(
        f"/api/cases/{open_case['id']}/vitals",
        headers=nurse["headers"],
        json={
            "temperatureC": 38.6,
            "bloodPressureSystolic": 118,
            "bloodPressureDiastolic": 76,
            "heartRate": 96,
            "respiratoryRate": 20,
            "oxygenSaturation": 97,
            "weightKg": 63.5,
        },
    )
    assert vitals.status_code == 201, vitals.get_json()
    recorded = vitals.get_json()["data"]
    assert recorded["temperatureC"] == 38.6

    history = client.get(f"/api/cases/{open_case['id']}/vitals", headers=nurse["headers"])
    assert history.status_code == 200
    assert len(history.get_json()["data"]) == 1


def test_vitals_reject_out_of_range_values(client, nurse, open_case):
    resp = client.post(
        f"/api/cases/{open_case['id']}/vitals",
        headers=nurse["headers"],
        json={"temperatureC": 90.0},  # impossible body temperature
    )
    assert resp.status_code == 422
    body = resp.get_json()
    assert body["success"] is False
    assert "range" in body["message"].lower()

    resp = client.post(f"/api/cases/{open_case['id']}/vitals",
                       headers=nurse["headers"], json={})
    assert resp.status_code == 422  # at least one vital required


def test_patient_cannot_record_vitals(client, patient, open_case):
    resp = client.post(f"/api/cases/{open_case['id']}/vitals",
                       headers=patient["headers"], json={"temperatureC": 37.0})
    assert resp.status_code == 403


def test_doctor_views_full_case(client, doctor, nurse, open_case):
    client.post(f"/api/cases/{open_case['id']}/vitals", headers=nurse["headers"],
                json={"temperatureC": 38.6, "heartRate": 96})

    resp = client.get(f"/api/cases/{open_case['id']}", headers=doctor["headers"])
    assert resp.status_code == 200
    case = resp.get_json()["data"]
    assert case["patient"]["id"]
    assert case["vitals"]["temperatureC"] == 38.6
    assert case["symptoms"][0]["label"] == "fever"
    assert "Asthma" in " ".join(case["history"])


def test_ai_recommendation_is_honest_503_without_model(client, doctor, open_case):
    """No artifact is configured in tests: the endpoint must return 503 with a
    real explanation — never fabricated predictions."""
    resp = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                       headers=doctor["headers"])
    assert resp.status_code == 503
    body = resp.get_json()
    assert body["success"] is False
    assert "model" in body["message"].lower()


def test_nurse_cannot_request_ai_recommendation(client, nurse, open_case):
    resp = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                       headers=nurse["headers"])
    assert resp.status_code == 403


def test_diagnosis_confirm_completes_case(client, doctor, open_case):
    created = client.post(
        f"/api/cases/{open_case['id']}/diagnosis",
        headers=doctor["headers"],
        json={"diseaseName": "Malaria", "severity": "moderate",
              "notes": "Focal exam clear; treat per protocol.", "confirmed": False},
    )
    assert created.status_code == 201, created.get_json()
    diagnosis = created.get_json()["data"]
    assert diagnosis["confirmed"] is False

    listed = client.get(f"/api/cases/{open_case['id']}/diagnosis", headers=doctor["headers"])
    assert listed.status_code == 200
    assert len(listed.get_json()["data"]) == 1

    confirmed = client.post(
        f"/api/cases/{open_case['id']}/confirm-diagnosis",
        headers=doctor["headers"],
        json={"diseaseName": "Malaria", "recommendationIndex": 0},
    )
    assert confirmed.status_code == 201
    assert confirmed.get_json()["data"]["confirmed"] is True

    detail = client.get(f"/api/cases/{open_case['id']}", headers=doctor["headers"])
    assert detail.get_json()["data"]["status"] == "completed"


def test_diagnosis_validation(client, doctor, open_case):
    resp = client.post(f"/api/cases/{open_case['id']}/diagnosis",
                       headers=doctor["headers"], json={"notes": "no disease name"})
    assert resp.status_code == 422
    resp = client.post(f"/api/cases/{open_case['id']}/diagnosis",
                       headers=doctor["headers"],
                       json={"diseaseName": "Flu", "severity": "apocalyptic"})
    assert resp.status_code == 422


def test_recommended_tests_sent_to_nurse_and_completed(client, doctor, nurse, open_case):
    assigned = client.post(
        f"/api/cases/{open_case['id']}/recommended-tests",
        headers=doctor["headers"],
        json={
            "tests": [{"name": "Widal test"}, "Blood culture"],
            "nurseId": nurse["id"],
            "instructions": "Collect before antibiotics.",
        },
    )
    assert assigned.status_code == 201, assigned.get_json()
    assignment = assigned.get_json()["data"]
    assert assignment["status"] == "sent"
    assert [t["name"] for t in assignment["tests"]] == ["Widal test", "Blood culture"]

    # The nurse sees it in her own queue.
    queue = client.get("/api/nurses/me/recommendations", headers=nurse["headers"])
    assert queue.status_code == 200
    items = queue.get_json()["data"]
    assert any(a["id"] == assignment["id"] for a in items)

    # And works it through its lifecycle.
    ack = client.patch(f"/api/nurses/assignments/{assignment['id']}/status",
                       headers=nurse["headers"], json={"status": "acknowledged"})
    assert ack.status_code == 200
    assert ack.get_json()["data"]["status"] == "acknowledged"

    done = client.patch(f"/api/nurses/assignments/{assignment['id']}/status",
                        headers=nurse["headers"], json={"status": "completed"})
    assert done.status_code == 200
    assert done.get_json()["data"]["status"] == "completed"
    assert done.get_json()["data"]["completedAt"]


def test_nurse_cannot_see_another_nurses_assignments(client, doctor, nurse, open_case):
    from tests.conftest import NURSE as OTHER

    register(client, {**OTHER, "staffId": "NUR-002", "fullName": "Other Nurse"})
    other_login = login(client, {"role": "nurse", "staffId": "NUR-002"})

    client.post(f"/api/cases/{open_case['id']}/recommended-tests",
                headers=doctor["headers"],
                json={"tests": ["Full blood count"], "nurseId": nurse["id"]})

    resp = client.get(f"/api/nurses/{nurse['id']}/recommendations",
                      headers=auth_headers(other_login))
    assert resp.status_code == 403

    own = client.get("/api/nurses/me/recommendations", headers=auth_headers(other_login))
    assert own.status_code == 200
    assert own.get_json()["data"] == []


def test_real_sklearn_artifact_end_to_end(tmp_path, client, doctor, open_case):
    """Full path: train artifact -> joblib -> adapter -> AIService -> HTTP 200."""
    import joblib

    from app.services import ai_service

    model_path = str(tmp_path / "malaria_model.joblib")
    joblib.dump(_TrainedMalariaModel(model_path), model_path)

    app = client.application
    app.config["AI_MODEL_PATH"] = model_path
    app.config["AI_FEATURE_SCHEMA_PATH"] = ""
    ai_service._CACHE.clear()  # fresh load for this artifact

    try:
        resp = client.post(f"/api/cases/{open_case['id']}/ai-recommendation",
                           headers=doctor["headers"])
        assert resp.status_code == 201, resp.get_json()
        recs = resp.get_json()["data"]
        assert recs, "expected at least one normalized recommendation"

        top = recs[0]
        # Normalized frontend contract.
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


def test_assign_tests_requires_a_test_list(client, doctor, open_case):
    resp = client.post(f"/api/cases/{open_case['id']}/recommended-tests",
                       headers=doctor["headers"], json={"tests": []})
    assert resp.status_code == 422


def test_patient_scoped_list_of_assignments(client, patient, doctor, open_case):
    client.post(f"/api/cases/{open_case['id']}/recommended-tests",
                headers=doctor["headers"], json={"tests": ["Chest X-ray"]})
    resp = client.get("/api/recommendations/assignments", headers=patient["headers"])
    assert resp.status_code == 200
    items = resp.get_json()["data"]
    assert len(items) == 1 and items[0]["patientId"] == patient["id"]


def test_staff_dashboard_endpoints_zero_state(client, admin):
    for path in ("/api/dashboard/basic", "/api/dashboard/patients",
                 "/api/dashboard/diagnosis", "/api/dashboard/appointments",
                 "/api/statistics"):
        resp = client.get(path, headers=admin["headers"])
        assert resp.status_code == 200, f"{path}: {resp.get_json()}"
        assert resp.get_json()["success"] is True


@pytest.mark.parametrize("path", ["/api/dashboard/basic", "/api/dashboard/appointments",
                                  "/api/statistics"])
def test_dashboard_endpoints_reject_patients(client, patient, path):
    resp = client.get(path, headers=patient["headers"])
    assert resp.status_code == 403
