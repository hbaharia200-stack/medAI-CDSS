#!/usr/bin/env python3
"""DEV-ONLY cleanup of the smoke/E2E test patients left in the dev database.

=============================================================================
NEVER RUNS AUTOMATICALLY. NEVER RUNS IN PRODUCTION.
=============================================================================

The Nurse Patient Queue is cluttered with "E2E Patient", "* Probe",
"Runtime Patient <epoch>" and "Lang/Agent Probe <epoch>" rows created by earlier
automated smoke tests. Those are real rows in the development SQLite file, so
they are NOT deleted implicitly anywhere: doing that from application code would
be unsafe (the same names could occur in a real dataset).

This script is therefore:

* opt-in — it only does anything when you run it explicitly;
* guarded — it refuses to run unless the app is in DEVELOPMENT and the target
  database is a local file;
* narrow — it only matches the exact, known test name patterns below, and it
  prints every row it intends to touch;
* reversible — it defaults to a dry run; deleting requires an explicit --apply.

Usage
-----
    python3 scripts/cleanup_dev_test_records.py              # dry run (safe)
    python3 scripts/cleanup_dev_test_records.py --apply      # actually delete
    python3 scripts/cleanup_dev_test_records.py --apply --pattern 'E2E Patient'

Deleting a patient cascades to their cases, symptoms, vitals, history,
diagnoses, AI recommendations and test assignments (see the model
relationships), so the queue is left consistent.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

#: The ONLY name patterns treated as smoke-test records. Each is anchored and
#: specific. A real patient called "Esau" is untouched; a real patient called
#: "E2E Patient" would be removed, so review the dry-run output first.
DEFAULT_PATTERNS = [
    r"^E2E Patient$",
    r"^E2E Head$",
    r"^E2E Headache$",
    r"^E2E Headache Patient$",
    r"^Probe Patient$",
    r"^Card Probe$",
    r"^Hover Probe$",
    r"^Runtime Patient \d{9,}$",
    r"^Lang Probe \d{9,}$",
    r"^Agent Probe \d{9,}$",
]


def _refuse(message: str) -> None:
    print(f"REFUSING TO RUN: {message}", file=sys.stderr)
    raise SystemExit(2)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Actually delete (default is a dry run).")
    parser.add_argument("--pattern", action="append", help="Extra exact-match regex (repeatable).")
    parser.add_argument(
        "--database-url",
        default=None,
        help="Override the database URL (must be a local sqlite file).",
    )
    args = parser.parse_args()

    # Keep this import AFTER the --help path so `--help` works without Flask.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    os_env = None
    try:
        from app import create_app
        from app.config import get_config
    except Exception as exc:  # noqa: BLE001
        _refuse(f"the backend package could not be imported ({exc}).")

    import os

    os_env = os.environ.get("FLASK_ENV", "default")
    if os_env != "development":
        _refuse(
            f"FLASK_ENV is {os_env!r}, not 'development'. This script may only run "
            "against a local development database."
        )

    app = create_app(get_config())
    if app.config.get("TESTING"):
        _refuse("the app is in TESTING mode; this script is for dev data only.")

    database_url = args.database_url or app.config.get("SQLALCHEMY_DATABASE_URI", "")
    if not database_url.startswith("sqlite:///"):
        _refuse(
            f"refusing to touch a non-sqlite database ({database_url.split('://')[0]}://...). "
            "This script is intentionally limited to the local dev SQLite file."
        )
    db_path = Path(database_url.replace("sqlite:///", "", 1))
    if not db_path.exists():
        _refuse(f"the configured database file does not exist: {db_path}")

    patterns = DEFAULT_PATTERNS + list(args.pattern or [])
    print(f"Database : {db_path}")
    print(f"Patterns : {len(patterns)}")
    for pattern in patterns:
        print(f"           - {pattern}")

    from app.extensions import db
    from app.models import PatientCase, PatientProfile, User, UserRole

    with app.app_context():
        query = db.session.query(User).filter(User.role == UserRole.patient)
        matches = [u for u in query.all() if any(re.match(p, u.full_name or "") for p in patterns)]

        if not matches:
            print("\nNo test records matched. Nothing to do.")
            return 0

        print(f"\n{len(matches)} test record(s) matched:\n")
        total_cases = 0
        for user in matches:
            cases = db.session.query(PatientCase).filter_by(patient_id=user.id).count()
            total_cases += cases
            print(f"  {user.id}  {user.full_name!r:34} phone={user.phone}  cases={cases}")
        print(f"\nTotal cases that would be removed with them: {total_cases}")

        if not args.apply:
            print("\nDRY RUN — nothing was deleted. Re-run with --apply to delete.")
            return 0

        for user in matches:
            profile = db.session.get(PatientProfile, user.id)
            if profile is not None:
                db.session.delete(profile)
            db.session.delete(user)
        db.session.commit()
        print(f"\nDeleted {len(matches)} test patient record(s) and {total_cases} case(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
