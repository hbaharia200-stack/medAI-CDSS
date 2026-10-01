"""Admin user management is a real write path, not a browser-side simulation.

The web "User management" screen used to edit an in-memory array, so every
add/edit/remove was lost on refresh and nothing reached the database. These
tests pin the real endpoints behind it: admin-only, persisted, auditable, and
they must never let a patient or a doctor escalate privileges.
"""
from tests.conftest import NURSE, login, register


def test_admin_can_create_a_staff_account_that_can_then_sign_in(client, admin):
    created = client.post(
        "/api/staff",
        headers=admin["headers"],
        json={
            "fullName": "Dr. New Hire",
            "role": "doctor",
            "staffId": "DR900",
            "specialization": "Cardiology",
        },
    )
    assert created.status_code == 201, created.get_json()
    body = created.get_json()["data"]
    assert body["role"] == "doctor"
    assert body["staff_id"] == "DR900"
    assert "password_hash" not in body

    # The account is real: the passwordless Staff ID login now works.
    signed_in = login(client, {"role": "doctor", "staffId": "DR900"})
    assert signed_in.status_code == 200, signed_in.get_json()
    assert signed_in.get_json()["user"]["specialization"] == "Cardiology"


def test_admin_can_edit_a_staff_account(client, admin, doctor):
    resp = client.patch(
        f"/api/staff/{doctor['id']}",
        headers=admin["headers"],
        json={"fullName": "Dr. Renamed", "specialization": "Paediatrics"},
    )
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()["data"]
    assert body["full_name"] == "Dr. Renamed"
    assert body["specialization"] == "Paediatrics"

    # The change is persisted, not just echoed back.
    again = login(client, {"role": "doctor", "staffId": doctor["user"]["staff_id"]})
    assert again.get_json()["user"]["full_name"] == "Dr. Renamed"


def test_admin_deactivation_blocks_staff_login(client, admin, nurse):
    """"Remove user" deactivates rather than deleting: clinical rows stay intact."""
    resp = client.patch(
        f"/api/staff/{nurse['id']}", headers=admin["headers"], json={"isActive": False}
    )
    assert resp.status_code == 200
    assert resp.get_json()["data"]["is_active"] is False

    blocked = login(client, {"role": "nurse", "staffId": NURSE["staffId"]})
    assert blocked.status_code == 403
    assert blocked.get_json()["error"] == "account_disabled"


def test_staff_cannot_create_or_edit_accounts(client, doctor, nurse):
    for method, path, payload in (
        ("post", "/api/staff", {"fullName": "X", "role": "doctor", "staffId": "DR901"}),
        ("patch", f"/api/staff/{nurse['id']}", {"fullName": "X"}),
    ):
        resp = getattr(client, method)(path, headers=doctor["headers"], json=payload)
        assert resp.status_code == 403, (method, path, resp.get_json())


def test_patient_cannot_reach_admin_writes(client, patient, nurse):
    resp = client.patch(
        f"/api/staff/{nurse['id']}", headers=patient["headers"], json={"isActive": False}
    )
    assert resp.status_code == 403


def test_admin_cannot_edit_a_patient_through_the_staff_endpoint(client, admin, patient):
    """Patients are managed elsewhere; this keeps the staff editor in its lane."""
    resp = client.patch(
        f"/api/staff/{patient['id']}", headers=admin["headers"], json={"fullName": "Hacked"}
    )
    assert resp.status_code == 403
    assert resp.get_json()["error"] == "forbidden_target"


def test_duplicate_staff_id_is_rejected_by_the_admin_editor(client, admin, doctor):
    register(client, {**NURSE, "staffId": "DR777"})
    resp = client.patch(
        f"/api/staff/{doctor['id']}",
        headers=admin["headers"],
        json={"staffId": "DR777"},
    )
    assert resp.status_code == 409


def test_unknown_staff_id_returns_404(client, admin):
    resp = client.patch(
        "/api/staff/does-not-exist", headers=admin["headers"], json={"fullName": "X"}
    )
    assert resp.status_code == 404
