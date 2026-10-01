"""One patient submission is shared intake, not an automatic test assignment."""
import pytest

from app.extensions import db
from app.models import PatientCase, RecommendedTestAssignment, User
from tests.conftest import PATIENT, auth_headers, login, register


def intake_payload():
    return {
        "chiefComplaint": "Headache",
        "symptoms": [{"label": "Headache", "severity": 2, "durationDays": 1}],
        "followUpAnswers": [{"questionId": "fever", "question": "Fever?", "answer": False}],
        "history": ["No known allergies"],
        "location": {"latitude": -6.8, "longitude": 39.28, "capturedAt": "2026-09-25T10:00:00Z"},
        "intake": {"name": "Grace Updated", "age": 31, "sex": "F", "phone": "+255700000010", "language": "sw"},
    }


def test_one_submission_persists_and_reaches_both_staff_queues(client, patient, doctor, nurse, admin):
    before_count = db.session.query(PatientCase).count()
    payload = intake_payload()
    response = client.post("/api/cases", headers=patient["headers"], json=payload)
    assert response.status_code == 201, response.get_json()
    submitted = response.get_json()["data"]
    case_id = submitted["id"]

    db.session.expire_all()
    assert db.session.query(PatientCase).count() == before_count + 1
    persisted = db.session.get(PatientCase, case_id)
    assert persisted.patient_id == patient["id"]
    assert persisted.status.value == "submitted"
    assert persisted.location == payload["location"]
    assert persisted.follow_up_answers == payload["followUpAnswers"]
    assert [s.label for s in persisted.symptoms] == ["Headache"]
    assert db.session.query(RecommendedTestAssignment).count() == 0

    for actor, path in ((doctor, "/api/cases/queue"), (admin, "/api/cases/queue"), (nurse, "/api/nurses/me/queue")):
        queue_response = client.get(path, headers=actor["headers"])
        assert queue_response.status_code == 200
        cases = [item["case"] for item in queue_response.get_json()["data"]]
        assert [case["id"] for case in cases] == [case_id]
        case = cases[0]
        assert case["patient"] == {"id": patient["id"], **payload["intake"]}
        assert case["status"] == "submitted"
        assert case["symptoms"][0]["label"] == "Headache"
        assert case["followUpAnswers"] == payload["followUpAnswers"]
        assert case["history"] == payload["history"]
        assert case["location"] == payload["location"]
        assert not {"aiRecommendations", "reasoningFactors", "recommendedTests", "assignments"} & case.keys()

    initial_assignments = client.get("/api/nurses/me/recommendations", headers=nurse["headers"])
    assert initial_assignments.status_code == 200
    assert initial_assignments.get_json()["data"] == []

    assigned = client.post(
        f"/api/cases/{case_id}/recommended-tests",
        headers=doctor["headers"],
        json={"tests": [{"id": "temperature", "name": "Temperature", "type": "vital"}], "nurseId": nurse["id"]},
    )
    assert assigned.status_code == 201, assigned.get_json()
    assignment = assigned.get_json()["data"]
    assert assignment["caseId"] == case_id
    assert assignment["patientId"] == patient["id"]
    assert assignment["doctorId"] == doctor["id"]
    assert assignment["status"] == "sent"

    assigned_queue = client.get("/api/nurses/me/recommendations", headers=nurse["headers"])
    assert [item["id"] for item in assigned_queue.get_json()["data"]] == [assignment["id"]]
    db.session.expire_all()
    assert db.session.query(PatientCase).count() == before_count + 1
    assert db.session.query(RecommendedTestAssignment).count() == 1


def test_send_to_nurse_without_a_named_nurse_reaches_the_nurse_inbox(client, patient, doctor, nurse):
    """Regression: "Send to Nurse" with no nurseId used to vanish.

    The web dashboard posts only ``{caseId, tests}``, so the assignment is
    created with ``nurse_id = NULL``. It must still reach the nursing pool
    (exactly like an unclaimed intake case) without exposing AI reasoning.
    """
    created = client.post("/api/cases", headers=patient["headers"], json=intake_payload())
    assert created.status_code == 201, created.get_json()
    case_id = created.get_json()["data"]["id"]

    sent = client.post(
        f"/api/cases/{case_id}/recommended-tests",
        headers=doctor["headers"],
        json={"tests": [{"id": "fbc", "name": "Full blood count", "type": "lab"}]},
    )
    assert sent.status_code == 201, sent.get_json()
    assignment = sent.get_json()["data"]
    assert assignment["nurseId"] is None
    assert assignment["caseId"] == case_id

    inbox = client.get("/api/nurses/me/recommendations", headers=nurse["headers"])
    assert inbox.status_code == 200
    assert [item["id"] for item in inbox.get_json()["data"]] == [assignment["id"]]

    # Nurse visibility is limited to the doctor-approved tests.
    assert client.get(
        f"/api/cases/{case_id}/recommendations", headers=nurse["headers"]
    ).status_code == 403

    # A named-nurse lookup stays exact: another nurse cannot claim it by id.
    other = register(client, {"role": "nurse", "fullName": "Other Nurse", "staffId": "NUR-002"})
    assert other.status_code == 201
    other_login = login(client, {"role": "nurse", "staffId": "NUR-002"})
    other_id = other_login.get_json()["user"]["id"]
    named = client.get(f"/api/nurses/{other_id}/recommendations", headers=doctor["headers"])
    assert named.status_code == 200
    assert named.get_json()["data"] == []




@pytest.mark.parametrize("actor_name", ["patient", "nurse"])
def test_patient_visibility_does_not_grant_permission_to_assign_tests(client, patient, nurse, open_case, actor_name):
    actor = {"patient": patient, "nurse": nurse}[actor_name]
    response = client.post(
        f"/api/cases/{open_case['id']}/recommended-tests",
        headers=actor["headers"],
        json={"tests": ["Temperature"], "nurseId": nurse["id"]},
    )
    assert response.status_code == 403
    assert db.session.query(RecommendedTestAssignment).count() == 0


@pytest.mark.parametrize("path", ["/api/cases/queue", "/api/nurses/me/queue", "/api/nurses/me/recommendations"])
def test_patient_cannot_read_staff_queues(client, patient, path):
    assert client.get(path, headers=patient["headers"]).status_code == 403


def test_case_submit_requires_jwt(client):
    response = client.post("/api/cases", json=intake_payload())
    assert response.status_code == 401
    assert db.session.query(PatientCase).count() == 0


@pytest.mark.parametrize("path", ["ai-recommendation", "recommendations"])
def test_ai_reasoning_reads_remain_doctor_only(client, patient, nurse, doctor, admin, open_case, path):
    endpoint = f"/api/cases/{open_case['id']}/{path}"
    for actor in (patient, nurse):
        assert client.get(endpoint, headers=actor["headers"]).status_code == 403
    for actor in (doctor, admin):
        assert client.get(endpoint, headers=actor["headers"]).status_code == 200


@pytest.mark.parametrize("patch", [{"name": " "}, {"age": "unknown"}, {"age": 131}, {"age": 2.5}, {"age": True}, {"sex": "unknown"}, {"phone": ""}, {"language": "xx"}])
def test_invalid_intake_does_not_create_case_or_change_profile(client, patient, patch):
    payload = intake_payload()
    payload["intake"].update(patch)
    response = client.post("/api/cases", headers=patient["headers"], json=payload)
    assert response.status_code == 422, response.get_json()
    db.session.expire_all()
    assert db.session.query(PatientCase).count() == 0
    user = db.session.get(User, patient["id"])
    assert user.full_name == PATIENT["name"]
    assert user.phone == PATIENT["phone"]
    assert user.patient_profile.age == PATIENT["age"]


def test_intake_cannot_reassign_case_or_overwrite_another_patient(client, patient):
    other_registration = register(client, {**PATIENT, "phone": "+255700000099", "email": "other-intake@example.com"})
    assert other_registration.status_code == 201
    other_login = login(client, {"role": "patient", "identifier": "+255700000099", "password": PATIENT["password"]})
    other_id = other_login.get_json()["user"]["id"]
    payload = intake_payload()
    payload["patientId"] = other_id
    response = client.post("/api/cases", headers=patient["headers"], json=payload)
    assert response.status_code == 201, response.get_json()
    case = response.get_json()["data"]
    assert case["patient"]["id"] == patient["id"]
    assert client.get(f"/api/cases/{case['id']}", headers=auth_headers(other_login)).status_code == 403
    db.session.expire_all()
    assert db.session.get(User, other_id).phone == "+255700000099"
    assert db.session.get(User, other_id).full_name == PATIENT["name"]


def test_intake_phone_conflict_does_not_create_a_case(client, patient):
    registered = register(client, {**PATIENT, "phone": "+255700000099", "email": "conflict-intake@example.com"})
    assert registered.status_code == 201
    payload = intake_payload()
    payload["intake"]["phone"] = "+255700000099"
    response = client.post("/api/cases", headers=patient["headers"], json=payload)
    assert response.status_code == 409, response.get_json()
    db.session.expire_all()
    assert db.session.query(PatientCase).count() == 0
    assert db.session.get(User, patient["id"]).full_name == PATIENT["name"]
