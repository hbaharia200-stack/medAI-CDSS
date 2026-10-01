"""Explicit, idempotent development account seeding.

This module is only called by the guarded ``flask seed-dev-users`` command.
It is never imported by request handling and never runs automatically.

It seeds two kinds of development reference data:

* the DR001/DR002/NR001 staff accounts used by the documented smoke test, and
* a small facility *test catalogue* (``RecommendedTest`` rows).

The catalogue is deliberately NOT clinical AI output. It is the facility's own
menu of orderable tests, which a doctor needs in order to tick tests by hand in
``GET /api/recommendations/tests``. Without it that endpoint is empty and the
doctor has no list to select from, so the "Send to Nurse" workflow cannot be
exercised without the trained model. Seeding it here keeps the doctor -> nurse
test workflow non-AI and honest.
"""
from __future__ import annotations

from app.extensions import db
from app.models import DoctorProfile, NurseProfile, RecommendedTest, User, UserRole

DEV_USERS = (
    {"staff_id": "DR001", "role": UserRole.doctor, "full_name": "Dr. Test One", "specialization": "General Medicine"},
    {"staff_id": "DR002", "role": UserRole.doctor, "full_name": "Dr. Test Two", "specialization": "General Medicine"},
    {"staff_id": "NR001", "role": UserRole.nurse, "full_name": "Nurse Test", "specialization": None},
)

# Minimal development catalogue of orderable tests. This is a *facility menu*,
# not a disease -> test prediction, and it is not derived from any model.
DEV_TEST_CATALOGUE = (
    ("Rapid Diagnostic Test (mRDT)", "Rapid malaria antigen test."),
    ("Blood smear / microscopy", "Malaria parasite microscopy."),
    ("Full blood count", "Haemoglobin, WBC and platelet indices."),
    ("Widal test", "Agglutination test for enteric fever."),
    ("Blood culture", "Aerobic culture with sensitivity."),
    ("Urine analysis", "Routine urinalysis."),
    ("Chest X-ray", "Plain radiograph of the chest."),
    ("ECG (12-lead)", "Twelve-lead electrocardiogram."),
    ("Blood glucose", "Random or fasting plasma glucose."),
    ("Malaria parasite (RDT) repeat", "Repeat rapid diagnostic test."),
)


def seed_dev_users() -> list[str]:
    changed: list[str] = []
    for spec in DEV_USERS:
        user = db.session.query(User).filter_by(staff_id=spec["staff_id"]).one_or_none()
        if user is None:
            user = User(
                full_name=spec["full_name"],
                role=spec["role"],
                staff_id=spec["staff_id"],
                language="en",
                is_active=True,
            )
            db.session.add(user)
            db.session.flush()
            changed.append(spec["staff_id"])
        if user.role != spec["role"]:
            raise RuntimeError(f"Existing {spec['staff_id']} has role {user.role}, expected {spec['role']}.")
        if spec["role"] == UserRole.doctor:
            profile = db.session.get(DoctorProfile, user.id)
            if profile is None:
                db.session.add(DoctorProfile(user_id=user.id, specialization=spec["specialization"]))
        else:
            if db.session.get(NurseProfile, user.id) is None:
                db.session.add(NurseProfile(user_id=user.id))
    db.session.commit()
    return changed


def seed_test_catalogue() -> list[str]:
    """Idempotently add the development test catalogue. Returns added names."""
    added: list[str] = []
    existing = {
        (row.name or "").strip().lower()
        for row in db.session.query(RecommendedTest).all()
    }
    for name, description in DEV_TEST_CATALOGUE:
        if name.strip().lower() in existing:
            continue
        db.session.add(RecommendedTest(name=name, description=description))
        added.append(name)
    if added:
        db.session.commit()
    return added


def seed_development_data() -> tuple[list[str], list[str]]:
    """Seed both reference datasets. Returns ``(staff_created, tests_created)``."""
    return seed_dev_users(), seed_test_catalogue()