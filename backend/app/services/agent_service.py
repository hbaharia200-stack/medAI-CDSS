"""Patient-agent boundary.

Conversation orchestration belongs here, never in React Native. The clinical
model adapter will be injected by the modelling teammate at the marked
boundary; until then this service returns an explicit unavailable state.

What *is* real today is everything around the model: the patient's transcript
and their uploaded files are persisted against their own account, so signing
out and back in restores the same history and the same attachments.
"""
from __future__ import annotations

from app.ai.contracts import PatientAgentResponse
from app.extensions import db
from app.models import (
    ALLOWED_CONTENT_TYPES,
    MAX_ATTACHMENT_BYTES,
    AgentAttachment,
    AgentMessage,
    AgentServiceRating,
    UserRole,
)
from app.services import case_service
from app.utils import AuthError, NotFoundError, ValidationError


MODEL_UNAVAILABLE_REPLY = "Clinical AI analysis is not available yet."

#: Server-owned fallback disclaimer, used only if the language layer is
#: unavailable. The localized versions live in ``services.ai.prompting``.
MODEL_DISCLAIMER = (
    "A healthcare professional should make the final clinical decision."
)

# Filenames are attacker-controlled. Keep only a safe, displayable tail and
# never build a filesystem path from the client's name.
_SAFE_NAME_CHARS = set(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._- ()"
)


def _role(actor) -> str:
    return actor.role.value if hasattr(actor.role, "value") else str(actor.role)


def record_service_rating(*, actor, rating, case_id: str | None = None,
                          language: str | None = None,
                          comment: str | None = None) -> dict:
    """Persist a patient's 1-5 service rating.

    A real write to a real table, done only because the patient actually tapped
    a rating. It is never called implicitly, and it stores no clinical content.
    """
    if _role(actor) != UserRole.patient.value:
        raise AuthError("forbidden_role", "Only a patient may rate the service.", 403)

    try:
        value = int(rating)
    except (TypeError, ValueError):
        raise ValidationError(
            "'rating' must be a whole number from 1 to 5.", "invalid_rating"
        )
    if not 1 <= value <= 5:
        raise ValidationError("'rating' must be between 1 and 5.", "invalid_rating")

    # Authorization: the rated case, if any, must belong to this patient.
    case = _resolve_case(actor, case_id)

    row = AgentServiceRating(
        patient_id=actor.id,
        case_id=case.id if case is not None else None,
        rating=value,
        language=language,
        comment=(comment or "").strip()[:500] or None,
    )
    db.session.add(row)
    db.session.commit()
    return {
        "id": row.id,
        "rating": row.rating,
        "caseId": row.case_id,
        "language": row.language,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


def ratings_summary(actor) -> dict:
    """The patient's own average rating, or an empty state when never rated."""
    if _role(actor) != UserRole.patient.value:
        raise AuthError("forbidden_role", "Only a patient may read their ratings.", 403)
    rows = (
        db.session.query(AgentServiceRating)
        .filter(AgentServiceRating.patient_id == actor.id)
        .all()
    )
    if not rows:
        return {"count": 0, "average": None}
    return {
        "count": len(rows),
        "average": round(sum(r.rating for r in rows) / len(rows), 2),
    }


def _safe_filename(raw: str | None) -> str:
    name = (raw or "").strip()
    # Strip any directory component a client may have included.
    name = name.replace("\\", "/").split("/")[-1]
    name = "".join(ch for ch in name if ch in _SAFE_NAME_CHARS).strip()
    if not name:
        name = "attachment"
    return name[:200]


def _resolve_case(actor, case_id: str | None):
    """Load the case the patient is talking about and authorize it.

    Returns ``None`` when no case was supplied. A case that exists but is not
    the caller's is rejected by ``require_access``; it is never silently
    downgraded to "no case".
    """
    if not case_id:
        return None
    case = case_service.get_case_or_404(case_id)
    case_service.require_access(actor, case)
    return case


def serialize_attachment(attachment) -> dict:
    return {
        "id": attachment.id,
        "caseId": attachment.case_id,
        "filename": attachment.filename,
        "contentType": attachment.content_type,
        "sizeBytes": attachment.size_bytes,
        "kind": attachment.kind,
        "createdAt": attachment.created_at.isoformat() if attachment.created_at else None,
    }


def serialize_message(message) -> dict:
    payload = {
        "id": message.id,
        "caseId": message.case_id,
        "role": message.role,
        "text": message.text,
        "createdAt": message.created_at.isoformat() if message.created_at else None,
    }
    if message.attachment_id:
        attachment = db.session.get(AgentAttachment, message.attachment_id)
        if attachment is not None:
            payload["attachment"] = serialize_attachment(attachment)
    return payload


def create_attachment(*, actor, storage, case_id: str | None) -> dict:
    """Store a real uploaded file for the authenticated patient.

    Only clinically reasonable types are accepted and the payload is bounded,
    so a client cannot store an executable or an unbounded blob.
    """
    if storage is None or not storage.filename:
        raise ValidationError("A file is required.", "missing_file")

    content_type = (storage.mimetype or "application/octet-stream").split(";")[0].strip().lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(f"'{content_type}' files are not accepted.", "unsupported_file_type")

    _resolve_case(actor, case_id)

    data = storage.read()
    if not data:
        raise ValidationError("The uploaded file is empty.", "empty_file")
    if len(data) > MAX_ATTACHMENT_BYTES:
        raise ValidationError(
            f"Files must be {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB or smaller.",
            "file_too_large",
        )

    attachment = AgentAttachment(
        patient_id=actor.id,
        case_id=case_id or None,
        uploaded_by=actor.id,
        filename=_safe_filename(storage.filename),
        content_type=content_type,
        size_bytes=len(data),
        kind="audio" if content_type.startswith("audio/") else "file",
        data=data,
    )
    db.session.add(attachment)
    db.session.commit()
    return serialize_attachment(attachment)


def get_attachment(actor, attachment_id: str):
    """Fetch an attachment, enforcing that a patient only reads their own."""
    attachment = db.session.get(AgentAttachment, attachment_id)
    if attachment is None:
        raise NotFoundError("Attachment not found.")
    if attachment.patient_id != actor.id and _role(actor) == UserRole.patient.value:
        raise AuthError(
            "forbidden_attachment", "This attachment belongs to another patient.", 403
        )
    return attachment


def _append_message(*, patient_id: str, case_id: str | None, role: str, text: str | None,
                    attachment_id: str | None = None) -> AgentMessage:
    message = AgentMessage(
        patient_id=patient_id,
        case_id=case_id or None,
        role=role,
        text=text,
        attachment_id=attachment_id,
    )
    db.session.add(message)
    return message


def _case_context(case) -> dict | None:
    """The subset of the real case the provider is allowed to see.

    Built from the same serialization the dashboard uses, trimmed to clinical
    facts the hospital system actually recorded. No ids, no contact details.
    """
    if case is None:
        return None
    try:
        payload = case_service.serialize_case_full(case)
    except Exception:  # noqa: BLE001 - never let context building break a chat
        return None

    patient = payload.get("patient") or {}
    context: dict = {
        "chiefComplaint": payload.get("chiefComplaint"),
        "status": payload.get("status"),
        "urgent": payload.get("urgent"),
        "symptoms": [
            {"label": s.get("label"), "severity": s.get("severity")}
            for s in (payload.get("symptoms") or [])
            if s.get("label")
        ],
        "followUpAnswers": [
            {"question": a.get("question"), "answer": a.get("answer")}
            for a in (payload.get("followUpAnswers") or [])
        ],
        "patientAge": patient.get("age"),
        "patientSex": patient.get("sex"),
    }
    # Vitals are only included when a nurse actually recorded them.
    vitals = payload.get("latestVitals")
    if vitals:
        context["recordedVitals"] = vitals
    return {k: v for k, v in context.items() if v not in (None, [], "")}


def _recent_turns(patient_id: str, limit: int = 6) -> list[dict]:
    """The tail of this patient's own transcript, for conversational context."""
    rows = (
        db.session.query(AgentMessage)
        .filter(AgentMessage.patient_id == patient_id)
        .order_by(AgentMessage.created_at.desc(), AgentMessage.id.desc())
        .limit(limit)
        .all()
    )
    return [{"role": m.role, "text": m.text} for m in reversed(rows)]


def _unavailable(reason: str | None = None, *, language: str = "en") -> PatientAgentResponse:
    """The controlled response when no provider can answer.

    This is the pre-existing, verified behaviour and the contract the mobile
    client already understands (``status: model_unavailable``). No clinical text
    is ever fabricated to fill the gap.
    """
    from app.services import ai as ai_layer
    from app.services.ai import prompting

    reason = reason or ai_layer.AIProviderError.NOT_CONFIGURED
    response: PatientAgentResponse = {
        "status": "model_unavailable",
        # Localized: a Kiswahili patient must never be shown an English system
        # message. This string is server-owned, never the model's.
        "reply": prompting.LOCALIZED_UNAVAILABLE.get(language, MODEL_UNAVAILABLE_REPLY),
        "disclaimer": prompting.LOCALIZED_DISCLAIMER.get(language, MODEL_DISCLAIMER),
        "actions": ["review_case"],
        "language": language,
        "providerStatus": reason,
    }
    return response


def _attach_patient_context(response: PatientAgentResponse, *, case, actor) -> None:
    """Attach cost, nearby facility and travel time — only when real.

    Each section is added independently and each one is *omitted* when its data
    source is unconfigured, so the response never implies we know something we
    do not. The model is never consulted for any of these values.
    """
    from app.services import cost_service, location_service

    conditions = response.get("possibleConditions") or []

    cost = cost_service.estimate_for_case(case, len(conditions))
    if cost:
        response["costEstimate"] = cost

    location = (getattr(case, "location", None) or {}) if case is not None else {}
    latitude, longitude = location.get("latitude"), location.get("longitude")
    if latitude is None or longitude is None:
        return  # No location: no hospital section at all.

    hospital = location_service.find_nearby(float(latitude), float(longitude))
    if not hospital:
        return  # No real facility data: omit rather than invent.

    travel = location_service.travel_estimate(
        {"latitude": latitude, "longitude": longitude}, hospital
    )
    response["hospital"] = {**hospital, **(travel or {})}
    # Only offer directions when a real route could actually be produced.
    if travel:
        response["actions"] = list(
            dict.fromkeys([*response.get("actions", []), "show_map"])
        )


def _should_ask_feedback(actor) -> bool:
    """True once this patient has reached a natural end of the journey.

    Checked *before* this turn's assistant row is written, so ``>= 2`` means the
    patient has already had two real exchanges and this is the third. Feedback is
    asked at most once per journey, never after every message. It is a
    *request* to rate: nothing is recorded unless the patient actually answers.
    """
    count = (
        db.session.query(AgentMessage)
        .filter(AgentMessage.patient_id == actor.id, AgentMessage.role == "assistant")
        .count()
    )
    return count >= 2


def _log_provider_state(reason: str | None) -> None:
    """Log the reason code only — never payloads, prompts or keys."""
    try:
        from flask import current_app

        current_app.logger.warning("Agent AI provider unavailable (%s)", reason or "unknown")
    except RuntimeError:
        pass


def respond(*, actor, message: str, case_id: str | None = None,
            attachment_id: str | None = None,
            language: str | None = None) -> PatientAgentResponse:
    if _role(actor) != UserRole.patient.value:
        raise AuthError("forbidden_role", "Only a patient may use the patient agent.", 403)

    case = _resolve_case(actor, case_id)

    # An attachment referenced by the client must be the caller's own upload.
    if attachment_id:
        get_attachment(actor, attachment_id)

    _append_message(
        patient_id=actor.id, case_id=case_id, role="patient",
        text=message or None, attachment_id=attachment_id,
    )

    # ---------------------------------------------------------------------
    # TEAMMATE AI INTEGRATION POINT
    # ---------------------------------------------------------------------
    # This is the single place the clinical model is invoked. Today it resolves
    # to whatever `AI_PROVIDER` selects, or nothing at all. When the modelling
    # teammate ships the clinical API, register it as a provider in
    # `app/services/ai/__init__.py`
    # and set AI_PROVIDER=teammate — then this block becomes the clinical call,
    # which is expected to return `ClinicalModelResult` (`app/ai/contracts.py`):
    # predictions `{disease, confidence}` plus typed recommended tests. The
    # client-facing `PatientAgentResponse` shape must not change.
    #
    #   clinical_result = clinical_ai_adapter.assess(case_payload, message)
    #   return present_patient_result(clinical_result)
    #
    # The safety wrapper below (output validation, server-owned disclaimer,
    # deterministic emergency escalation) applies to the teammate provider too:
    # a provider is never trusted to police clinical safety.
    # ---------------------------------------------------------------------
    response = _respond_via_provider(
        actor, message, case, bool(attachment_id), language=language
    )

    # Deterministic, non-model sections. Each is omitted when its real data
    # source is unconfigured, so nothing is ever invented to fill a gap.
    _attach_patient_context(response, case=case, actor=actor)

    # Ask for a service rating only at a natural end of the journey, never
    # after every message.
    if _should_ask_feedback(actor):
        response["askFeedback"] = True

    # Persist exactly what was served. No clinical text is invented here.
    _append_message(
        patient_id=actor.id, case_id=case_id, role="assistant", text=response["reply"],
    )
    db.session.commit()
    return response


def _respond_via_provider(actor, message: str, case, has_attachment: bool,
                          *, language: str | None = None) -> PatientAgentResponse:
    """Ask the configured provider, then validate. Never raises to the client."""
    from app.services import ai as ai_layer

    # Normalized once, here: an unknown tag falls back to English rather than
    # failing the patient's request.
    language = ai_layer.prompting.normalize_language(language)

    try:
        provider = ai_layer.get_provider()
    except ai_layer.AIProviderError as exc:
        _log_provider_state(exc.reason)
        return _unavailable(exc.reason, language=language)

    if provider is None:
        # AI_PROVIDER is unset: keep the documented model_unavailable contract.
        return _unavailable(ai_layer.AIProviderError.NOT_CONFIGURED, language=language)

    usable, reason = provider.available()
    if not usable:
        _log_provider_state(reason)
        return _unavailable(
            reason or ai_layer.AIProviderError.NOT_CONFIGURED, language=language
        )

    request = ai_layer.AgentProviderRequest(
        system_prompt=ai_layer.prompting.SYSTEM_PROMPT,
        user_prompt=ai_layer.prompting.build_user_prompt(
            message=message,
            case_context=_case_context(case),
            recent_turns=_recent_turns(actor.id),
            has_attachment=has_attachment,
            language=language,
        ),
        json_mode=True,
    )

    try:
        raw = provider.generate(request)
        return ai_layer.prompting.validate_agent_reply(
            raw, patient_message=message, language=language
        )
    except ai_layer.AIProviderError as exc:
        # Missing key, auth failure, rate limit, timeout, network, 5xx, or an
        # unusable provider message.
        _log_provider_state(exc.reason)
        return _unavailable(exc.reason, language=language)
    except ValueError:
        # The provider answered with something unsafe to parse or validate.
        _log_provider_state(ai_layer.AIProviderError.INVALID_RESPONSE)
        return _unavailable(ai_layer.AIProviderError.INVALID_RESPONSE, language=language)
    except Exception as exc:  # noqa: BLE001 - a provider bug must not 500 a patient
        _log_provider_state("provider_error")
        try:
            from flask import current_app

            current_app.logger.exception("Agent provider raised %s", type(exc).__name__)
        except RuntimeError:
            pass
        return _unavailable("provider_error", language=language)




def history(actor, limit: int = 200) -> list[dict]:
    """The authenticated patient's own transcript, oldest first."""
    if _role(actor) != UserRole.patient.value:
        raise AuthError("forbidden_role", "Only a patient may read their agent history.", 403)
    rows = (
        db.session.query(AgentMessage)
        .filter(AgentMessage.patient_id == actor.id)
        .order_by(AgentMessage.created_at.asc(), AgentMessage.id.asc())
        .limit(limit)
        .all()
    )
    return [serialize_message(m) for m in rows]

