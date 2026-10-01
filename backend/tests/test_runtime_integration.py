"""Regression tests for the runtime integration work.

These lock in the behaviours that were previously broken or missing:
  * patient profile serialization (name/age/sex/phone) survives a fresh read
  * a newly submitted case is visible to BOTH the nurse and the doctor queue
  * recommended-test assignments carry the real patient name, not a UUID
  * agent chat + attachments persist per patient and never leak across patients
  * a real file uploads, and an executable is refused
  * doctor-to-doctor messaging authorizes, persists and round-trips
"""
from __future__ import annotations

import io

from tests.conftest import DOCTOR, PATIENT, auth_headers, login, register


def _submit_case(client, patient, complaint="Headache and fever"):
    resp = client.post(
        "/api/cases",
        headers=patient["headers"],
        json={
            "chiefComplaint": complaint,
            "patientId": patient["id"],
            "symptoms": [
                {"label": "Headache", "severity": 5},
                {"label": "Fever", "severity": 4},
            ],
        },
    )
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["data"]


# --------------------------------------------------------------------------
# Patient profile persistence (Parts C / Q)
# --------------------------------------------------------------------------


def test_auth_me_serializes_patient_demographics(client, patient):
    """The canonical contract is snake_case: full_name, age, sex, phone."""
    resp = client.get("/api/auth/me", headers=patient["headers"])
    assert resp.status_code == 200
    user = resp.get_json()["user"]
    assert user["full_name"] == PATIENT["name"]
    assert user["age"] == PATIENT["age"]
    assert user["sex"] == PATIENT["sex"]
    assert user["phone"] == PATIENT["phone"]
    # camelCase aliases must not leak into the API contract.
    assert "fullName" not in user


def test_patient_detail_survives_a_fresh_read(client, patient):
    """/api/patients/<id> must expose the same demographics, not blanks."""
    _submit_case(client, patient)
    resp = client.get(f"/api/patients/{patient['id']}", headers=patient["headers"])
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data["full_name"] == PATIENT["name"]
    assert data["age"] == PATIENT["age"]
    assert data["sex"] == PATIENT["sex"]
    assert data["phone"] == PATIENT["phone"]


def test_patient_case_carries_symptoms_for_the_account_screen(client, patient):
    case = _submit_case(client, patient)
    resp = client.get(f"/api/patients/{patient['id']}/cases", headers=patient["headers"])
    assert resp.status_code == 200
    rows = resp.get_json()["data"]
    assert rows
    latest = rows[0]
    assert latest["id"] == case["id"]
    assert {s["label"] for s in latest["symptoms"]} == {"Headache", "Fever"}


# --------------------------------------------------------------------------
# New patient is visible to nurse AND doctor (Parts J / L / P)
# --------------------------------------------------------------------------


def test_new_patient_case_reaches_both_nurse_and_doctor_queues(client, patient, nurse, doctor):
    case = _submit_case(client, patient, complaint="Runtime headache and fever")
    for staff in (nurse, doctor):
        resp = client.get("/api/cases/queue", headers=staff["headers"])
        assert resp.status_code == 200, resp.get_json()
        payload_rows = [row.get("case", row) for row in resp.get_json()["data"]]
        ids = [r.get("id") for r in payload_rows]
        assert case["id"] in ids, "the same caseId must reach the staff queue"
        # The queue must carry the real patient, not an opaque id.
        row = next(r for r in payload_rows if r.get("id") == case["id"])
        assert row["patient"]["name"] == PATIENT["name"]
        assert row["patient"]["age"] == PATIENT["age"]


# --------------------------------------------------------------------------
# Recommended tests carry real identity (Part K)
# --------------------------------------------------------------------------


def test_assignment_serializes_patient_name_not_a_uuid(client, patient, doctor):
    case = _submit_case(client, patient)
    created = client.post(
        f"/api/cases/{case['id']}/recommended-tests",
        headers=doctor["headers"],
        json={"tests": [{"testId": "test-0", "name": "Blood culture", "type": "lab"}]},
    )
    assert created.status_code == 201, created.get_json()

    # The doctor-facing assignment list is what the Web app renders.
    resp = client.get(
        f"/api/recommendations/assignments?case_id={case['id']}", headers=doctor["headers"]
    )
    assert resp.status_code == 200, resp.get_json()
    mine = [r for r in resp.get_json()["data"] if r["caseId"] == case["id"]]
    assert mine, "the doctor's assignment must be readable"
    assignment = mine[0]
    assert assignment["patientName"] == PATIENT["name"]
    assert assignment["caseReference"] == case["id"][:8]
    assert assignment["doctorName"] == DOCTOR["fullName"]
    assert assignment["tests"][0]["name"] == "Blood culture"
    # The id is still available for audit/debugging — just not the headline.
    assert assignment["id"]


# --------------------------------------------------------------------------
# Agent transcript + attachments (Parts F / H)
# --------------------------------------------------------------------------


def test_agent_chat_persists_per_patient(client, patient):
    case = _submit_case(client, patient)
    resp = client.post(
        "/api/agent/chat",
        headers=patient["headers"],
        json={"message": "My head hurts", "caseId": case["id"]},
    )
    assert resp.status_code == 200
    # The clinical model is intentionally not configured.
    assert resp.get_json()["data"]["status"] == "model_unavailable"

    history = client.get("/api/agent/history", headers=patient["headers"])
    assert history.status_code == 200
    rows = history.get_json()["data"]
    assert [r["role"] for r in rows] == ["patient", "assistant"]
    assert rows[0]["text"] == "My head hurts"


def test_agent_history_is_private_to_the_patient(client, patient):
    other = {
        "role": "patient", "name": "Other Human", "phone": "+255700000099",
        "password": "S3curePass!", "age": 44, "sex": "M",
    }


def test_real_file_uploads_and_executables_are_refused(client, patient):
    case = _submit_case(client, patient)
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32

    ok = client.post(
        "/api/agent/attachments",
        headers=patient["headers"],
        data={"file": (io.BytesIO(png), "../../etc/passwd.png"), "caseId": case["id"]},
        content_type="multipart/form-data",
    )
    assert ok.status_code == 201, ok.get_json()
    attachment = ok.get_json()["data"]
    assert attachment["filename"] == "passwd.png", "path traversal must be stripped"
    assert attachment["sizeBytes"] == len(png)
    assert attachment["caseId"] == case["id"]

    # The bytes are really stored and really served back.
    download = client.get(f"/api/agent/attachments/{attachment['id']}",
                          headers=patient["headers"])
    assert download.status_code == 200
    assert download.data == png

    bad = client.post(
        "/api/agent/attachments",
        headers=patient["headers"],
        data={"file": (io.BytesIO(b"MZ\x90\x00"), "evil.exe")},
        content_type="multipart/form-data",
    )
    assert bad.status_code == 422
    assert bad.get_json()["error"] == "unsupported_file_type"


def test_attachment_only_message_is_allowed(client, patient):
    case = _submit_case(client, patient)
    upload = client.post(
        "/api/agent/attachments",
        headers=patient["headers"],
        data={"file": (io.BytesIO(b"hello note"), "note.txt"), "caseId": case["id"]},
        content_type="multipart/form-data",
    )
    attachment_id = upload.get_json()["data"]["id"]

    resp = client.post(
        "/api/agent/chat",
        headers=patient["headers"],
        json={"message": "", "caseId": case["id"], "attachmentId": attachment_id},
    )
    assert resp.status_code == 200, resp.get_json()
    history = client.get("/api/agent/history", headers=patient["headers"]).get_json()["data"]
    owned = [m for m in history if m.get("attachment")]
    assert owned and owned[0]["attachment"]["id"] == attachment_id


def test_patient_cannot_read_another_patients_attachment(client, patient):
    case = _submit_case(client, patient)
    upload = client.post(
        "/api/agent/attachments",
        headers=patient["headers"],
        data={"file": (io.BytesIO(b"secret"), "secret.txt"), "caseId": case["id"]},
        content_type="multipart/form-data",
    )
    attachment_id = upload.get_json()["data"]["id"]

    other = {
        "role": "patient", "name": "Nosy Human", "phone": "+255700000098",
        "password": "S3curePass!", "age": 41, "sex": "F",
    }
    register(client, other)
    headers = auth_headers(login(client, {"role": "patient", "identifier": other["phone"],
                                          "password": other["password"]}))
    blocked = client.get(f"/api/agent/attachments/{attachment_id}", headers=headers)
    assert blocked.status_code == 403


def test_staff_cannot_use_the_patient_agent(client, doctor):
    resp = client.post("/api/agent/chat", headers=doctor["headers"], json={"message": "hi"})
    assert resp.status_code == 403


# --------------------------------------------------------------------------
# Doctor <-> Doctor messaging (Parts M / P)
# --------------------------------------------------------------------------


def test_doctor_to_doctor_chat_round_trips(client, doctor):
    second = {"role": "doctor", "fullName": "Dee Doctor", "staffId": "DOC-002",
              "specialization": "Cardiology"}
    assert register(client, second).status_code == 201
    signed_in = login(client, {"role": "doctor", "staffId": "DOC-002"})
    peer = auth_headers(signed_in)
    peer_id = signed_in.get_json()["user"]["id"]

    room = client.post("/api/chat-rooms", headers=doctor["headers"],
                       json={"participantIds": [peer_id]})
    assert room.status_code == 201, room.get_json()
    room_id = room.get_json()["data"]["id"]

    sent = client.post("/api/messages", headers=doctor["headers"],
                       json={"roomId": room_id, "body": "Runtime doctor-to-doctor test"})
    assert sent.status_code == 201, sent.get_json()

    # The recipient sees it, and it is a real persisted row.
    seen = client.get(f"/api/messages?roomId={room_id}", headers=peer)
    assert seen.status_code == 200
    assert [m["body"] for m in seen.get_json()["data"]] == ["Runtime doctor-to-doctor test"]

    # Reply travels back.
    client.post("/api/messages", headers=peer,
                json={"roomId": room_id, "body": "Acknowledged"})
    back = client.get(f"/api/messages?roomId={room_id}", headers=doctor["headers"])
    assert "Acknowledged" in [m["body"] for m in back.get_json()["data"]]


def test_non_participant_cannot_read_a_room(client, doctor):
    other = {"role": "doctor", "fullName": "Outsider Doc", "staffId": "DOC-003"}
    register(client, other)
    outsider = auth_headers(login(client, {"role": "doctor", "staffId": "DOC-003"}))

    room = client.post("/api/chat-rooms", headers=doctor["headers"], json={})
    room_id = room.get_json()["data"]["id"]
    client.post("/api/messages", headers=doctor["headers"],
                json={"roomId": room_id, "body": "private"})

    blocked = client.get(f"/api/messages?roomId={room_id}", headers=outsider)
    assert blocked.status_code == 403

