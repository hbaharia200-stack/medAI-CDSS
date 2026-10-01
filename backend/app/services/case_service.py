"""Clinical case workflow: patient intake -> nurse vitals -> doctor review.

Authorization is enforced here (not in the UI): patients only ever touch their
own cases, staff share the intake queue, and every clinical mutation is written
to the audit log.
"""
from __future__ import annotations

from app.extensions import db
from app.models import CaseStatus, PatientCase, UserRole
from app.repositories import case_repo, log_audit
from app.repositories.case_repo import add_vitals as _repo_add_vitals
from app.schemas.case import serialize_case_full, serialize_queue, serialize_symptom
from app.schemas import _dt
from app.utils import (
    AuthError,
    NotFoundError,
    ValidationError,
    coerce_bool,
    normalize_sex,
    validate_vitals,
)

# Documented status transitions (see backend/API.md).
ALLOWED_TRANSITIONS = {
    "submitted": {"ai_assessed", "doctor_reviewing", "doctor_unavailable", "appointment_required"},
    "ai_assessed": {"doctor_reviewing", "sent_to_nurse", "doctor_unavailable"},
    "doctor_reviewing": {"sent_to_nurse", "doctor_unavailable", "appointment_required", "doctor_final_review"},
    "sent_to_nurse": {"tests_in_progress", "tests_completed", "doctor_final_review"},
    "tests_in_progress": {"tests_completed", "doctor_final_review"},
    "tests_completed": {"doctor_final_review", "treatment"},
    "doctor_final_review": {"treatment", "follow_up", "completed"},
    "treatment": {"completed", "follow_up"},
    "doctor_unavailable": {"appointment_required", "doctor_reviewing"},
    "appointment_required": {"doctor_reviewing", "follow_up"},
    "follow_up": {"submitted", "completed"},
    # Legacy transitions allow old records to be advanced without a reset.
    "intake_pending": {"vitals_pending", "awaiting_review", "in_review", "submitted", "completed"},
    "vitals_pending": {"awaiting_review", "in_review", "submitted", "completed"},
    "awaiting_review": {"in_review", "doctor_reviewing", "completed", "vitals_pending"},
    "in_review": {"awaiting_review", "sent_to_nurse", "doctor_final_review", "completed"},
    "completed": {"in_review", "follow_up"},
}

_STAFF_ROLES = {UserRole.nurse.value, UserRole.doctor.value, UserRole.admin.value}


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


def can_view_case(actor, case: PatientCase) -> bool:
    """Access rule for a single case."""
    role = _role(actor)
    if role == UserRole.admin.value:
        return True
    if role == UserRole.patient.value:
        return case.patient_id == actor.id
    if role in (UserRole.doctor.value, UserRole.nurse.value):
        # Staff see the shared intake queue, so any case is readable; writes are
        # additionally checked per action below.
        return True
    return False


def get_case_or_404(case_id: str) -> PatientCase:
    case = case_repo.get_case(case_id)
    if case is None:
        raise NotFoundError("Clinical case not found.")
    return case


def require_access(actor, case: PatientCase) -> None:
    if not can_view_case(actor, case):
        raise AuthError("forbidden_case", "You do not have access to this case.", 403)


def require_staff(actor) -> None:
    if _role(actor) not in _STAFF_ROLES:
        raise AuthError("forbidden_staff", "This action is restricted to clinical staff.", 403)


def case_payload(case_id: str) -> dict:
    case = get_case_or_404(case_id)
    return serialize_case_full(case)


# ---------------------------------------------------------------------------
# Intake
# ---------------------------------------------------------------------------


def _symptom_dicts(raw) -> list[dict]:
    if raw in (None, ""):
        return []
    if not isinstance(raw, list):
        raise ValidationError("'symptoms' must be a list.", "invalid_symptoms")
    out = []
    for item in raw:
        if isinstance(item, str):
            label = item.strip()
            if label:
                out.append({"label": label})
            continue
        if not isinstance(item, dict):
            raise ValidationError("Each symptom must be a string or an object.", "invalid_symptoms")
        label = (item.get("label") or "").strip()
        if not label:
            raise ValidationError("Each symptom needs a 'label'.", "invalid_symptoms")
        severity = item.get("severity")
        if severity not in (None, ""):
            try:
                severity = int(severity)
            except (TypeError, ValueError) as exc:
                raise ValidationError("'severity' must be 1-5.", "invalid_severity") from exc
            if severity < 1 or severity > 5:
                raise ValidationError("'severity' must be between 1 and 5.", "invalid_severity")
        duration = item.get("durationDays")
        if duration not in (None, ""):
            duration = int(duration)
        out.append({
            "label": label,
            "bodyRegion": item.get("bodyRegion"),
            "severity": severity,
            "durationDays": duration,
            "notes": item.get("notes"),
        })
    return out


def _intake_demographics(raw) -> dict | None:
    """Validate the optional mobile intake block before changing a profile."""
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise ValidationError("'intake' must be an object.", "invalid_intake")

    cleaned = {}
    for field, maximum in (("name", 255), ("phone", 32)):
        value = raw.get(field)
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
            raise ValidationError(f"'intake.{field}' must be a non-empty string of at most {maximum} characters.", "invalid_intake")
        cleaned[field] = value.strip()

    age = raw.get("age")
    if isinstance(age, bool) or not isinstance(age, int) or not 0 <= age <= 130:
        raise ValidationError("'intake.age' must be a whole number between 0 and 130.", "invalid_age")
    cleaned["age"] = age
    sex = raw.get("sex")
    # Same normaliser as registration/patient updates, so a value this API
    # itself stored can always be submitted back (the round-trip bug: a profile
    # written as "MALE" was rejected here as invalid_sex).
    cleaned["sex"] = normalize_sex(sex)
    language = raw.get("language")
    if language not in ("en", "sw"):
        raise ValidationError("'intake.language' must be 'en' or 'sw'.", "invalid_language")
    cleaned["language"] = language
    return cleaned


def create_case(data: dict, actor) -> PatientCase:
    """Create a clinical case.

    Patients may only create cases for themselves (``patientId`` is ignored);
    staff may create one on behalf of a patient by supplying ``patientId``.
    """
    role = _role(actor)
    if role == UserRole.patient.value:
        patient_id = actor.id
    else:
        patient_id = (data.get("patientId") or data.get("patient_id") or "").strip()
        if not patient_id:
            raise ValidationError("'patientId' is required when staff create a case.", "required_field_missing")

    complaint = (data.get("chiefComplaint") or data.get("chief_complaint") or "").strip()
    if not complaint:
        raise ValidationError("'chiefComplaint' is required.", "required_field_missing")

    urgent = coerce_bool(data.get("urgent"))
    symptoms = _symptom_dicts(data.get("symptoms"))
    history_raw = data.get("history") or []
    if isinstance(history_raw, str):
        history_raw = [history_raw]
    history = [str(h).strip() for h in history_raw if str(h).strip()]
    location = data.get("location")
    if location is not None:
        if not isinstance(location, dict) or not all(key in location for key in ("latitude", "longitude", "capturedAt")):
            raise ValidationError("'location' must include latitude, longitude and capturedAt.", "invalid_location")
    follow_up_answers = data.get("followUpAnswers") or data.get("follow_up_answers") or []
    if not isinstance(follow_up_answers, list):
        raise ValidationError("'followUpAnswers' must be a list.", "invalid_follow_up_answers")
    demographics = _intake_demographics(data.get("intake"))

    nurse_id = data.get("nurseId") if role in _STAFF_ROLES else None
    doctor_id = data.get("doctorId") if role in _STAFF_ROLES else None

    try:
        if demographics is not None:
            from app.services.patient_service import update_patient

            # The authenticated patient's profile and the canonical case are
            # saved together, so either both persist or neither does.
            update_patient(patient_id, demographics, commit=False)

        case = case_repo.create_case(
            patient_id=patient_id,
            chief_complaint=complaint,
            symptoms=symptoms,
            history=history,
            urgent=urgent,
            nurse_id=nurse_id,
            doctor_id=doctor_id,
            location=location,
            follow_up_answers=follow_up_answers,
        )
        if role == UserRole.nurse.value and not nurse_id:
            case.nurse_id = actor.id
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise

    log_audit(
        action="case.created",
        user_id=actor.id,
        role=role,
        patient_case_id=case.id,
        detail={"urgent": urgent, "symptoms": len(symptoms)},
    )
    return case


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


def nurse_patient_detail(case: PatientCase, *, assignments: list[dict] | None = None) -> dict:
    """The Nurse "Patient details" payload for one case.

    Assembled ONLY from records that already exist: the case, its patient and
    the doctor's test assignments. Nothing is defaulted, guessed or invented —
    a field the backend does not hold is simply ``None``/absent, so the screen
    can say "not recorded" rather than show a fabricated value.

    Deliberately excludes anything sensitive: no password hash, no token, no
    email, and no account data unrelated to this patient's care.
    """
    from app.repositories import patient_repo
    from app.schemas.case import serialize_vital_signs, _latest_vital

    patient = case.patient
    profile = patient_repo.get_patient_profile(patient.id) if patient else None

    def _name(user) -> str | None:
        return user.full_name if user is not None else None

    return {
        "caseId": case.id,
        # Short, non-reversible reference the nurse can read out. The full uuid
        # is never needed for triage and is not exposed here.
        "caseReference": (case.uuid or case.id)[:8].upper(),
        "patient": {
            "id": patient.id if patient else None,
            "name": patient.full_name if patient else None,
            "age": profile.age if profile else None,
            "sex": profile.sex if profile else None,
            "phone": patient.phone if patient else None,
            "language": patient.language if patient else None,
        },
        "chiefComplaint": case.chief_complaint,
        "symptoms": [serialize_symptom(s) for s in (case.symptoms or [])],
        "followUpAnswers": case.follow_up_answers or [],
        "history": [h.entry for h in (case.medical_history or [])],
        "status": case.status.value if hasattr(case.status, "value") else case.status,
        "urgent": bool(case.urgent),
        "createdAt": _dt(case.created_at),
        "updatedAt": _dt(case.updated_at),
        "vitals": serialize_vital_signs(_latest_vital(case)),
        # Workflow — only what is genuinely assigned. A null doctor is rendered
        # as "not assigned yet", never as a made-up name.
        "assignedDoctor": _name(case.doctor),
        "assignedNurse": _name(case.nurse),
        "nurseId": case.nurse_id,
        "doctorId": case.doctor_id,
        "diagnoses": [
            {
                "id": d.id,
                "diseaseName": d.disease_name,
                "notes": d.notes,
                "recordedAt": _dt(d.recorded_at),
            }
            for d in (case.diagnoses or [])
        ],
        "tests": assignments or [],
        # Location is optional clinical context. It is included because staff
        # already receive it on the queue payload, and omitted entirely when the
        # patient declined to share it.
        "location": case.location,
    }


def list_cases(
    actor,
    *,
    status: str | None = None,
    patient_id: str | None = None,
    doctor_id: str | None = None,
    nurse_id: str | None = None,
    urgent: bool | None = None,
    include_completed: bool = True,
    limit: int | None = None,
    offset: int = 0,
) -> dict:
    role = _role(actor)
    if role == UserRole.patient.value:
        # Patients are hard-scoped to their own records.
        patient_id = actor.id
    rows, total = case_repo.list_cases_filtered(
        status=status,
        patient_id=patient_id,
        doctor_id=doctor_id,
        nurse_id=nurse_id,
        urgent=urgent,
        include_completed=include_completed,
        order="desc" if status == CaseStatus.completed.value else "asc",
        limit=limit,
        offset=offset,
    )
    return {"items": [serialize_case_full(c) for c in rows], "total": total}


def list_queue(actor, *, limit: int | None = None) -> list[dict]:
    """Open cases shaped as the dashboard's ``QueueCase[]``."""
    role = _role(actor)
    doctor_id = actor.id if role == UserRole.doctor.value else None
    nurse_id = actor.id if role == UserRole.nurse.value else None
    cases = case_repo.queue_cases(doctor_id=doctor_id, nurse_id=nurse_id, limit=limit)
    return serialize_queue(cases)


# ---------------------------------------------------------------------------
# Mutations
# ---------------------------------------------------------------------------


def _assert_transition(current: str, target: str, *, force: bool = False) -> None:
    if force:
        return
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise ValidationError(
            f"Cannot move a case from '{current}' to '{target}'. "
            f"Allowed: {', '.join(sorted(allowed)) or 'none'}.",
            "invalid_status_transition",
        )


def update_case(case_id: str, data: dict, actor) -> PatientCase:
    """Update status / urgency / assignment. Doctors and nurses share the queue."""
    case = get_case_or_404(case_id)
    role = _role(actor)
    if role == UserRole.patient.value:
        raise AuthError("forbidden_staff", "Patients cannot update case workflow fields.", 403)

    if data.get("status"):
        target = str(data["status"]).strip()
        if target not in {s.value for s in CaseStatus}:
            raise ValidationError(
                f"'status' must be one of: {', '.join(s.value for s in CaseStatus)}.",
                "invalid_status",
            )
        _assert_transition(
            case.status.value if hasattr(case.status, "value") else str(case.status),
            target,
            force=coerce_bool(data.get("force")) and role == UserRole.admin.value,
        )
        case.status = CaseStatus(target)

    if "urgent" in data:
        case.urgent = coerce_bool(data.get("urgent"))

    # A doctor claims a case by assigning themselves (or an admin assigns one).
    if data.get("doctorId"):
        case.doctor_id = data["doctorId"]
    elif data.get("claim") and role == UserRole.doctor.value:
        case.doctor_id = actor.id

    if data.get("nurseId"):
        case.nurse_id = data["nurseId"]
    elif data.get("claimNurse") and role == UserRole.nurse.value:
        case.nurse_id = actor.id

    case_repo.save_case(case)
    log_audit(
        action="case.updated",
        user_id=actor.id,
        role=role,
        patient_case_id=case.id,
        detail={k: data.get(k) for k in ("status", "urgent", "doctorId", "nurseId", "claim") if k in data},
    )
    return case


def add_vitals(case_id: str, data: dict, actor) -> dict:
    """Nurse records a vitals reading (validated against hard clinical bounds)."""
    require_staff(actor)
    case = get_case_or_404(case_id)
    cleaned = validate_vitals(data)
    urgent_flag = coerce_bool(data.get("urgentFlag") or data.get("urgent"))
    vital = _repo_add_vitals(case_id, cleaned, urgent_flag, actor.id)
    # Recording vitals always makes the case reviewable by a doctor.
    if case.status in (CaseStatus.intake_pending, CaseStatus.vitals_pending, CaseStatus.submitted):
        case.status = CaseStatus.awaiting_review
    db.session.commit()

    log_audit(
        action="case.vitals_recorded",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=case_id,
        detail={"urgent": urgent_flag, "fields": sorted(cleaned.keys())},
    )
    return vital.to_dict()


def add_symptoms(case_id: str, raw_symptoms, actor) -> list[dict]:
    require_staff(actor)
    case = get_case_or_404(case_id)
    symptoms = _symptom_dicts(raw_symptoms)
    if not symptoms:
        raise ValidationError("At least one symptom is required.", "required_field_missing")
    created = [
        case_repo.add_symptom(
            case.id,
            label=s["label"],
            body_region=s.get("bodyRegion"),
            severity=s.get("severity"),
            duration_days=s.get("durationDays"),
            notes=s.get("notes"),
        )
        for s in symptoms
    ]
    db.session.commit()
    log_audit(
        action="case.symptoms_added",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=case.id,
        detail={"count": len(created)},
    )
    from app.schemas.case import serialize_symptom

    return [serialize_symptom(s) for s in created]


def add_history(case_id: str, entries, actor) -> list[str]:
    require_staff(actor)
    case = get_case_or_404(case_id)
    if isinstance(entries, str):
        entries = [entries]
    if not isinstance(entries, list) or not entries:
        raise ValidationError("'entries' must be a non-empty list or string.", "required_field_missing")
    created = [
        case_repo.add_history(case.id, str(entry).strip(), patient_id=case.patient_id)
        for entry in entries
        if str(entry).strip()
    ]
    db.session.commit()
    log_audit(
        action="case.history_added",
        user_id=actor.id,
        role=_role(actor),
        patient_case_id=case.id,
        detail={"count": len(created)},
    )
    return [h.entry for h in created]