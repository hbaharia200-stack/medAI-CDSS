"""Appointments (public booking + doctor dashboard), billing, messaging."""
import datetime

from tests.conftest import auth_headers, login, register


# ---------------------------------------------------------------------------
# Public appointment booking (no account) — matches the landing-page form
# ---------------------------------------------------------------------------


def _booking(**over):
    base = {
        "patientName": "Zawadi Mwakyusa",
        "phone": "+255712345678",
        "email": "zawadi@example.com",
        "doctor": "General Medicine",
        "preferredDate": (
            datetime.date.today() + datetime.timedelta(days=2)
        ).isoformat(),
        "preferredTime": "10:30",
        "reason": "Persistent headache for one week.",
    }
    base.update(over)
    return base


def test_public_booking_creates_appointment(client):
    resp = client.post("/api/appointments", json=_booking())
    assert resp.status_code == 201, resp.get_json()
    body = resp.get_json()
    # Frontend contract: id/status readable at the top level of the JSON.
    assert body["id"]
    assert body["status"] == "pending"
    assert body["data"]["patientName"] == "Zawadi Mwakyusa"


def test_booking_validation(client):
    resp = client.post("/api/appointments", json=_booking(phone=""))
    assert resp.status_code == 422

    resp = client.post("/api/appointments", json=_booking(email="not-an-email"))
    assert resp.status_code == 422

    resp = client.post("/api/appointments",
                       json=_booking(preferredDate="1999-01-01"))
    assert resp.status_code == 422  # date in the past

    resp = client.post("/api/appointments",
                       json=_booking(preferredTime="25:99"))
    assert resp.status_code == 422  # invalid time


def test_booking_resolves_existing_doctor(client, doctor):
    resp = client.post("/api/appointments", json=_booking(doctor="Dan Doctor"))
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["data"]["doctorResolved"] is True
    assert body["data"]["doctorId"] == doctor["id"]


def test_booking_is_persisted_not_localstorage(client, admin):
    client.post("/api/appointments", json=_booking())
    listed = client.get("/api/appointments", headers=admin["headers"])
    assert listed.status_code == 200
    assert listed.get_json()["total"] == 1


def test_appointment_filters(client, admin):
    client.post("/api/appointments", json=_booking())
    by_status = client.get("/api/appointments?status=pending", headers=admin["headers"])
    assert by_status.get_json()["total"] == 1
    cancelled = client.get("/api/appointments?status=cancelled", headers=admin["headers"])
    assert cancelled.get_json()["total"] == 0
    today = datetime.date.today().isoformat()
    by_date = client.get(f"/api/appointments?date={today}", headers=admin["headers"])
    assert by_date.status_code == 200


def test_patient_can_cancel_own_appointment(client, patient):
    booked = client.post("/api/appointments", json=_booking(email=patient["user"]["email"]))
    appointment_id = booked.get_json()["id"]

    cancelled = client.post(f"/api/appointments/{appointment_id}/cancel",
                            headers=patient["headers"])
    assert cancelled.status_code == 200
    assert cancelled.get_json()["data"]["status"] == "cancelled"


def test_appointments_require_auth(client):
    resp = client.get("/api/appointments")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------


def test_invoice_lifecycle(client, admin, patient):
    created = client.post(
        "/api/invoices",
        headers=admin["headers"],
        json={
            "patientId": patient["id"],
            "title": "Consultation",
            "items": [{"description": "Consultation fee", "amount": 15000}],
        },
    )
    assert created.status_code == 201, created.get_json()
    invoice = created.get_json()["data"]
    assert invoice["totalAmount"] == 15000.0

    paid = client.post(
        f"/api/invoices/{invoice['id']}/payments",
        headers=admin["headers"],
        json={"amount": 15000, "method": "cash"},
    )
    assert paid.status_code == 201, paid.get_json()

    fetched = client.get(f"/api/invoices/{invoice['id']}", headers=admin["headers"])
    assert fetched.get_json()["data"]["status"] == "paid"

    mine = client.get("/api/invoices", headers=patient["headers"])
    assert mine.status_code == 200
    assert any(i["id"] == invoice["id"] for i in mine.get_json()["data"])

    ledger = client.get("/api/payments", headers=admin["headers"])
    assert ledger.status_code == 200
    assert ledger.get_json()["total"] == 1


def test_patient_cannot_create_invoice(client, patient):
    resp = client.post("/api/invoices", headers=patient["headers"],
                       json={"patientId": patient["id"], "items": []})
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Messaging foundation
# ---------------------------------------------------------------------------


def test_chat_room_and_message_flow(client, patient, doctor):
    room = client.post(
        "/api/chat-rooms",
        headers=patient["headers"],
        json={"participantIds": [doctor["id"]], "title": "Follow-up"},
    )
    assert room.status_code == 201, room.get_json()
    room_id = room.get_json()["data"]["id"]

    sent = client.post(
        "/api/messages",
        headers=patient["headers"],
        json={"roomId": room_id, "body": "Good morning, doctor."},
    )
    assert sent.status_code == 201, sent.get_json()

    listed = client.get(f"/api/messages?roomId={room_id}", headers=patient["headers"])
    assert listed.status_code == 200
    assert listed.get_json()["data"][0]["body"] == "Good morning, doctor."

    rooms = client.get("/api/chat-rooms", headers=doctor["headers"])
    assert rooms.status_code == 200
    assert any(r["id"] == room_id for r in rooms.get_json()["data"])

    register(client, {"role": "patient", "name": "Stranger",
                      "phone": "+255700000123", "password": "Str0ngPass!"})
    outsider_login = login(client, {"role": "patient", "identifier": "+255700000123",
                                    "password": "Str0ngPass!"})
    denied = client.get(f"/api/messages?roomId={room_id}",
                        headers=auth_headers(outsider_login))
    assert denied.status_code == 403


def test_messages_require_room(client, patient):
    resp = client.get("/api/messages", headers=patient["headers"])
    assert resp.status_code == 422
