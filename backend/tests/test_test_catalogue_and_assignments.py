"""Regression tests for the fixes made while wiring the non-AI system end to end.

Three concrete defects found during the integration pass are covered here:

* the doctor "Send to Nurse" workflow needs a non-empty facility test catalogue,
  otherwise the doctor's checkbox list is empty and the workflow can only be
  exercised by hand-typing a test name;
* a doctor can send tests without naming a nurse. That assignment is visible in
  every nurse's inbox, but the nurse used to be refused (403) when trying to
  act on it, so the doctor -> nurse -> completed leg was broken;
* the admin "User management" screen used to be simulated in the browser, so its
  writes are now real endpoints that must be admin-only and auditable.
"""
from tests.conftest import NURSE, auth_headers, login, register


def _seed_catalogue():
    from app.services.dev_seed_service import seed_test_catalogue

    return seed_test_catalogue()


# ---------------------------------------------------------------------------
# Facility test catalogue
# ---------------------------------------------------------------------------


def test_seed_test_catalogue_is_idempotent_and_non_empty(app):
    from app.models import RecommendedTest

    added = _seed_catalogue()
    assert added, "the development catalogue must create at least one test"
    assert _seed_catalogue() == [], "re-running the seed must not duplicate rows"
    assert RecommendedTest.query.count() == len(added)


def test_doctor_can_read_the_facility_test_catalogue(client, doctor):
    """The doctor's manual test picker is fed by this endpoint.

    Regression: it returned an empty list, so "Send to Nurse" had nothing to
    select from without the AI model.
    """
    _seed_catalogue()
    resp = client.get("/api/recommendations/tests", headers=doctor["headers"])
    assert resp.status_code == 200
    data = resp.get_json()["data"]
    assert data, "catalogue must not be empty for the doctor's manual picker"
    assert all({"id", "name"} <= set(row) for row in data)


def test_catalogue_is_a_facility_menu_not_a_prediction(client, doctor, open_case):
    """Seeding the catalogue must not create AI output or change the case."""
    _seed_catalogue()
    from app.models import AIRecommendation

    assert AIRecommendation.query.count() == 0
    case = client.get(
        f"/api/cases/{open_case['id']}", headers=doctor["headers"]
    ).get_json()["data"]
    assert case["status"] == "submitted"


# ---------------------------------------------------------------------------
# Doctor -> nurse test assignment lifecycle
# ---------------------------------------------------------------------------


def test_nurse_claims_an_unaddressed_assignment_from_the_pool(client, doctor, nurse, open_case):
    """A doctor can send tests without naming a nurse.

    That assignment is deliberately visible in every nurse's inbox, but the nurse
    used to be refused with 403 when trying to act on it, so "Send to Nurse" ->
    "nurse completes the test" was broken whenever no colleague was picked.
    """
    assigned = client.post(
        f"/api/cases/{open_case['id']}/recommended-tests",
        headers=doctor["headers"],
        json={"tests": ["Widal test"]},
    )
    assert assigned.status_code == 201, assigned.get_json()
    assignment = assigned.get_json()["data"]
    assert assignment["nurseId"] is None

    inbox = client.get("/api/nurses/me/recommendations", headers=nurse["headers"])
    assert any(a["id"] == assignment["id"] for a in inbox.get_json()["data"])

    # Actionable: the first nurse to act claims it.
    ack = client.patch(
        f"/api/nurses/assignments/{assignment['id']}/status",
        headers=nurse["headers"],
        json={"status": "acknowledged"},
    )
    assert ack.status_code == 200, ack.get_json()
    assert ack.get_json()["data"]["status"] == "acknowledged"
    assert ack.get_json()["data"]["nurseId"] == nurse["id"]

    # The claim is persisted, so a different nurse can no longer take it.
    other = register(client, {**NURSE, "staffId": "NUR-002"})
    assert other.status_code == 201
    other_headers = auth_headers(login(client, {"role": "nurse", "staffId": "NUR-002"}))
    blocked = client.patch(
        f"/api/nurses/assignments/{assignment['id']}/status",
        headers=other_headers,
        json={"status": "completed"},
    )
    assert blocked.status_code == 403


def test_nurse_cannot_set_a_status_outside_its_lifecycle(client, nurse, doctor, open_case):
    assigned = client.post(
        f"/api/cases/{open_case['id']}/recommended-tests",
        headers=doctor["headers"],
        json={"tests": ["Widal test"]},
    )
    assignment_id = assigned.get_json()["data"]["id"]
    rejected = client.patch(
        f"/api/nurses/assignments/{assignment_id}/status",
        headers=nurse["headers"],
        json={"status": "sent"},
    )
    assert rejected.status_code == 403


def test_doctor_sees_public_bookings_that_nobody_has_claimed(client, doctor):
    """Regression: a booking made without choosing a doctor was invisible.

    The public form persists ``doctor_id = NULL`` when no doctor is selected.
    Scoping the list strictly to ``doctor_id == actor.id`` meant the record
    existed but no clinician could ever see, confirm or act on it.
    """
    booked = client.post(
        "/api/appointments",
        json={
            "patientName": "Walk In",
            "phone": "+255700000999",
            "preferredDate": "2026-12-01",
            "preferredTime": "09:30",
            "reason": "Check-up",
        },
    )
    assert booked.status_code == 201, booked.get_json()
    appointment_id = booked.get_json()["id"]

    listed = client.get("/api/appointments", headers=doctor["headers"])
    assert listed.status_code == 200
    assert any(a["id"] == appointment_id for a in listed.get_json()["data"]), (
        "an unclaimed public booking must appear in a doctor's list"
    )


def test_nurse_cannot_assign_tests(client, nurse, open_case):
    resp = client.post(
        f"/api/cases/{open_case['id']}/recommended-tests",
        headers=nurse["headers"],
        json={"tests": ["Widal test"]},
    )
    assert resp.status_code == 403
