"""Public booking + doctor appointment-dashboard endpoints."""
from __future__ import annotations

import datetime

from tests.conftest import auth_headers, login, register

# tomorrow at 10:30 — always a valid future slot
_DAY = datetime.date.today() + datetime.timedelta(days=1)
PUBLIC_BOOKING = {
    "patientName": "Grace Patient",
    "phone": "+255700000001",  # matches the patient fixture's phone
    "email": "grace@example.com",
    "doctor": "Dan Doctor",
    "preferredDate": _DAY.isoformat(),
    "preferredTime": "10:30",
    "reason": "Persistent fever and headache",
}


def test_public_booking_validation_listing_and_lifecycle(client, patient, doctor):
    resp = client.post("/api/appointments", json=PUBLIC_BOOKING)
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["success"] is True
    # Public booking contract: id/status are top-level (frontend reads them there).
    assert body["id"] and body["status"] == "pending"
    appt_id = body["id"]

    # Field-level validation errors:
    resp = client.post("/api/appointments", json={**PUBLIC_BOOKING, "email": "not-an-email"})
    assert resp.status_code == 422 and resp.get_json()["success"] is False
    resp = client.post("/api/appointments", json={**PUBLIC_BOOKING, "preferredDate": "1999-01-01"})
    assert resp.status_code == 422
    resp = client.post("/api/appointments", json={k: v for k, v in PUBLIC_BOOKING.items() if k != "phone"})
    assert resp.status_code == 422

    # Authenticated dashboard listing + filters (doctor sees own bookings):
    listing = client.get("/api/appointments", headers=doctor["headers"])
    assert listing.status_code == 200
    items = listing.get_json()["data"]
    assert any(a["id"] == appt_id for a in items)
    assert all(a["status"] in ("pending", "confirmed", "completed", "cancelled") for a in items)

    by_date = client.get(f"/api/appointments?date={PUBLIC_BOOKING['preferredDate']}", headers=doctor["headers"])
    assert by_date.status_code == 200
    assert any(a["id"] == appt_id for a in by_date.get_json()["data"])

    by_status = client.get("/api/appointments?status=pending", headers=doctor["headers"])
    assert all(a["status"] == "pending" for a in by_status.get_json()["data"])

    # Doctor confirms; patient may only cancel.
    ok_confirm = client.post(f"/api/appointments/{appt_id}/confirm", headers=doctor["headers"])
    assert ok_confirm.status_code == 200 and ok_confirm.get_json()["data"]["status"] == "confirmed"

    cancel = client.post(f"/api/appointments/{appt_id}/cancel", headers=patient["headers"])
    assert cancel.status_code == 200 and cancel.get_json()["data"]["status"] == "cancelled"


def test_public_booking_conflict_when_doctor_slot_taken(client, doctor):
    first = client.post("/api/appointments", json={**PUBLIC_BOOKING, "doctor": "DOC-001"})
    assert first.status_code == 201
    assert first.get_json()["data"]["doctorResolved"] is True
    second = client.post("/api/appointments", json={**PUBLIC_BOOKING, "doctor": "DOC-001"})
    assert second.status_code == 409


def test_public_booking_resolves_unknown_doctor_gracefully(client):
    resp = client.post("/api/appointments", json={**PUBLIC_BOOKING, "doctor": "Unknown Specialist X"})
    assert resp.status_code == 201
    assert resp.get_json()["data"]["doctorResolved"] is False


def test_patient_cannot_confirm_own_appointment(client, patient):
    booked = client.post("/api/appointments", json=PUBLIC_BOOKING)
    appt_id = booked.get_json()["id"]
    resp = client.post(f"/api/appointments/{appt_id}/confirm", headers=patient["headers"])
    assert resp.status_code == 403

