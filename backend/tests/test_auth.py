"""Registration, login, JWT issuance, refresh/logout and role-based access."""
from tests.conftest import ADMIN, DOCTOR, PATIENT, auth_headers, login, register


def test_patient_registration_hashes_password_and_creates_profile(client):
    resp = register(client, PATIENT)
    assert resp.status_code == 201
    body = resp.get_json()
    assert body["user"]["role"] == "patient"
    assert "password_hash" not in body["user"]  # hash never leaves the server


def test_duplicate_registration_conflicts(client):
    register(client, PATIENT)
    resp = register(client, PATIENT)
    assert resp.status_code == 409
    assert resp.get_json()["success"] is False


def test_duplicate_patient_phone_conflicts(client):
    register(client, PATIENT)
    resp = register(client, {**PATIENT, "email": "different-phone-check@example.com"})
    assert resp.status_code == 409
    assert resp.get_json()["error"] == "conflict"
    assert "phone" in resp.get_json()["message"].lower()


def test_registration_validation_errors(client):
    resp = register(client, {"role": "patient", "name": "No Phone", "password": "x"})
    assert resp.status_code == 422
    resp = register(client, {"role": "martian", "name": "x"})
    assert resp.status_code == 422
    assert "role" in resp.get_json()["message"].lower() or resp.get_json()["error"]


def test_patient_login_success_and_failure(client):
    register(client, PATIENT)
    ok = login(client, {"role": "patient", "identifier": PATIENT["phone"],
                        "password": PATIENT["password"]})
    assert ok.status_code == 200
    body = ok.get_json()
    assert body["access_token"] and body["token_type"] == "Bearer"
    assert body["user"]["role"] == "patient"

    bad = login(client, {"role": "patient", "identifier": PATIENT["phone"],
                         "password": "wrong-pass"})
    assert bad.status_code == 401
    assert bad.get_json()["success"] is False


def test_staff_passwordless_login_by_staff_id(client):
    register(client, DOCTOR)
    ok = login(client, {"role": "doctor", "staffId": DOCTOR["staffId"]})
    assert ok.status_code == 200
    assert ok.get_json()["user"]["role"] == "doctor"

    wrong = login(client, {"role": "doctor", "staffId": "GHOST-999"})
    assert wrong.status_code == 401


def test_nurse_passwordless_login_returns_nurse_jwt(client):
    from tests.conftest import NURSE

    register(client, NURSE)
    response = login(client, {"role": "nurse", "staffId": NURSE["staffId"]})
    assert response.status_code == 200
    assert response.get_json()["user"]["role"] == "nurse"


def test_authenticated_staff_directory_returns_safe_doctors(client, doctor):
    from tests.conftest import DOCTOR

    register(client, {**DOCTOR, "staffId": "DOC-002", "fullName": "Second Doctor"})
    response = client.get("/api/staff?role=doctor", headers=doctor["headers"])
    assert response.status_code == 200
    entry = next(item for item in response.get_json()["data"] if item["staffId"] == "DOC-002")
    assert entry["fullName"] == "Second Doctor"
    assert "email" not in entry
    assert "phone" not in entry


def test_development_seed_is_idempotent(client, app):
    from app.services.dev_seed_service import seed_dev_users
    from app.models import User

    assert seed_dev_users() == ["DR001", "DR002", "NR001"]
    assert seed_dev_users() == []
    assert client.post("/api/auth/login", json={"role": "doctor", "staffId": "DR001"}).status_code == 200
    assert client.post("/api/auth/login", json={"role": "doctor", "staffId": "DR002"}).status_code == 200
    assert client.post("/api/auth/login", json={"role": "nurse", "staffId": "NR001"}).status_code == 200
    assert User.query.filter(User.staff_id.in_(["DR001", "DR002", "NR001"])).count() == 3


def test_staff_id_login_is_case_insensitive_and_trimmed(client, app):
    """Regression: DR002 was rejected when typed as 'dr002'.

    Staff IDs are read off a badge, so the lookup must not depend on letter
    case or stray whitespace, and it must stay a real credential check.
    """
    from app.services.dev_seed_service import seed_dev_users

    assert seed_dev_users() == ["DR001", "DR002", "NR001"]

    for credential in ("DR002", "dr002", "Dr002", "  DR002  "):
        response = login(client, {"role": "doctor", "staffId": credential})
        assert response.status_code == 200, (credential, response.get_json())
        assert response.get_json()["user"]["staff_id"] == "DR002"

    assert login(client, {"role": "nurse", "staffId": "nr001"}).status_code == 200

    # Case folding must not turn a wrong Staff ID into a valid one.
    assert login(client, {"role": "doctor", "staffId": "dr999"}).status_code == 401
    # A nurse account cannot sign in through the doctor route.
    assert login(client, {"role": "doctor", "staffId": "nr001"}).status_code == 401


def test_duplicate_staff_id_differing_only_by_case_is_rejected(client):
    register(client, DOCTOR)
    resp = register(client, {**DOCTOR, "staffId": DOCTOR["staffId"].lower(),
                             "email": "case-dupe-doctor@example.com"})
    assert resp.status_code == 409




def test_me_requires_jwt(client):
    assert client.get("/api/auth/me").status_code == 401

    register(client, PATIENT)
    resp = login(client, {"role": "patient", "identifier": PATIENT["phone"],
                          "password": PATIENT["password"]})
    me = client.get("/api/auth/me", headers=auth_headers(resp))
    assert me.status_code == 200
    assert me.get_json()["user"]["email"] == PATIENT["email"]


def test_refresh_and_logout_blocklist(client):
    register(client, PATIENT)
    login_resp = login(client, {"role": "patient", "identifier": PATIENT["phone"],
                                "password": PATIENT["password"]})
    body = login_resp.get_json()
    # Refresh endpoint requires the refresh token (not access token).
    refresh_headers = {"Authorization": f"Bearer {body['refresh_token']}"}
    refresh = client.post("/api/auth/refresh", headers=refresh_headers)
    assert refresh.status_code == 200
    assert refresh.get_json()["access_token"]

    logout = client.post("/api/auth/logout", headers=refresh_headers)
    assert logout.status_code == 200
    replay = client.post("/api/auth/refresh", headers=refresh_headers)
    assert replay.status_code == 401  # token is blocklisted server-side


def test_role_guard_forbids_patient_on_staff_endpoint(client, patient, open_case):
    resp = client.get("/api/cases/queue", headers=patient["headers"])
    assert resp.status_code == 403
    assert resp.get_json()["success"] is False


def test_role_guard_forbids_nurse_from_diagnosis(client, nurse, open_case):
    resp = client.post(
        f"/api/cases/{open_case['id']}/diagnosis",
        headers=nurse["headers"],
        json={"diseaseName": "Malaria"},
    )
    assert resp.status_code == 403


def test_unauthenticated_request_is_401_json(client):
    resp = client.get("/api/cases")
    assert resp.status_code == 401
    body = resp.get_json()
    assert body["success"] is False and "message" in body


def test_admin_login_requires_password(client):
    register(client, ADMIN)
    ok = login(client, {"role": "admin", "identifier": ADMIN["email"],
                        "password": ADMIN["password"]})
    assert ok.status_code == 200
    bad = login(client, {"role": "admin", "identifier": ADMIN["email"], "password": "nope"})
    assert bad.status_code == 401
