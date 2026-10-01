"""Pytest fixtures: in-memory app + role-authenticated API clients."""
from __future__ import annotations

import os

# Must be set BEFORE app.config is imported (dotenv may otherwise win).
os.environ["FLASK_ENV"] = "testing"
os.environ.pop("AI_MODEL_PATH", None)  # tests: no model artifact; DI instead

import pytest  # noqa: E402

from app import create_app  # noqa: E402
from app.extensions import db as _db  # noqa: E402


@pytest.fixture()
def app():
    app = create_app()
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


# ---------------------------------------------------------------------------
# Registration / login helpers (use the real HTTP API — no model factories —
# so the tests exercise exactly what the frontend exercises).
# ---------------------------------------------------------------------------

PATIENT = {"role": "patient", "name": "Grace Patient", "phone": "+255700000001",
           "email": "grace@example.com", "password": "S3curePass!", "age": 30, "sex": "F"}
NURSE = {"role": "nurse", "fullName": "Nina Nurse", "staffId": "NUR-001"}
DOCTOR = {"role": "doctor", "fullName": "Dan Doctor", "staffId": "DOC-001",
          "specialization": "General Medicine"}
ADMIN = {"role": "admin", "fullName": "Ada Admin", "email": "admin@example.com",
         "password": "Adm1nPass!"}


def register(client, payload: dict):
    return client.post("/api/auth/register", json=payload)


def login(client, payload: dict):
    return client.post("/api/auth/login", json=payload)


def auth_headers(resp) -> dict:
    body = resp.get_json()
    return {"Authorization": f"Bearer {body['access_token']}"}


@pytest.fixture()
def patient(client):
    resp = register(client, PATIENT)
    assert resp.status_code == 201, resp.get_json()
    resp = login(client, {"role": "patient", "identifier": PATIENT["phone"],
                          "password": PATIENT["password"]})
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    return {"id": body["user"]["id"], "headers": auth_headers(resp), "user": body["user"]}


@pytest.fixture()
def nurse(client):
    resp = register(client, NURSE)
    assert resp.status_code == 201, resp.get_json()
    resp = login(client, {"role": "nurse", "staffId": NURSE["staffId"]})
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    return {"id": body["user"]["id"], "headers": auth_headers(resp), "user": body["user"]}


@pytest.fixture()
def doctor(client):
    resp = register(client, DOCTOR)
    assert resp.status_code == 201, resp.get_json()
    resp = login(client, {"role": "doctor", "staffId": DOCTOR["staffId"]})
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    return {"id": body["user"]["id"], "headers": auth_headers(resp), "user": body["user"]}


@pytest.fixture()
def admin(client):
    resp = register(client, ADMIN)
    assert resp.status_code == 201, resp.get_json()
    resp = login(client, {"role": "admin", "identifier": ADMIN["email"],
                          "password": ADMIN["password"]})
    assert resp.status_code == 200, resp.get_json()
    body = resp.get_json()
    return {"id": body["user"]["id"], "headers": auth_headers(resp), "user": body["user"]}


@pytest.fixture()
def open_case(client, patient):
    """A patient-opened case with symptoms + history, still awaiting vitals."""
    resp = client.post(
        "/api/cases",
        headers=patient["headers"],
        json={
            "chiefComplaint": "Fever and cough for 3 days",
            "symptoms": [
                {"label": "fever", "severity": 3, "durationDays": 3},
                {"label": "cough", "severity": 2},
            ],
            "history": ["Asthma (childhood)"],
        },
    )
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["data"]
