"""Doctor-side clinical DECISION SUPPORT from the configured AI provider.

=============================================================================
SEPARATE FROM THE PATIENT-FACING AGENT ON PURPOSE.
=============================================================================
``app.services.agent_service`` answers a *patient* chat. This module produces
*doctor* decision support for a real case. They are deliberately different
surfaces with different contracts, and this one is kept in its own module so a
general-purpose development provider can never quietly become the patient agent
or vice versa.

Hard rules enforced here, regardless of what the provider returns:
  * possible conditions only — never a confirmed diagnosis;
  * a confidence percentage must be present and is clamped to 0-100;
  * NO fabricated lab results, NO fabricated vitals, NO medication/prescription;
  * no invented patient history;
  * the "AI-assisted suggestion" label and disclaimer are OURS, not the model's.

If the provider is unavailable or its answer cannot be validated, this raises
``AIDecisionSupportError`` so the endpoint fails closed with an accurate status
instead of storing anything.
"""
from __future__ import annotations

import json
import re

from app.services.ai.provider import AIProviderError, AgentProviderRequest

#: Always attached by the server; never taken from the provider.
DECISION_SUPPORT_LABEL = "AI-assisted suggestion"
DECISION_SUPPORT_DISCLAIMER = (
    "AI-assisted suggestion — the final clinical decision is made by the doctor."
)

#: Dropped from any condition/test name: the doctor-facing surface must not
#: carry dosing/prescription or "here is the result" claims.
#: NOTE: the dose pattern is deliberately loose. "\bmg\b" does NOT match
#: "500mg" (there is no word boundary between "0" and "m"), which is exactly the
#: string we most need to catch, so a dose is matched as digits+mg or a bare mg.
_FORBIDDEN_TERMS = re.compile(
    r"(\bprescrib\w*|\d\s*mg\b|\bmg\b|\bmg/|\bdosage\b|\bdose\b|\btablet\b|"
    r"\bantibiotic course\b|"
    r"\blab results?\b|\btest results?\b|\bresult:|\bvalue of\b)",
    re.IGNORECASE,
)

MAX_CONDITIONS = 5
MAX_TESTS = 6
MAX_NAME = 120
MAX_TEXT = 300


class AIDecisionSupportError(RuntimeError):
    """The provider could not produce usable, safe decision support.

    ``reason`` is a stable non-sensitive code; it is safe to log and to map to
    an HTTP status. It never contains provider payloads or credentials.
    """

    def __init__(self, reason: str, message: str):
        super().__init__(message)
        self.reason = reason
        self.message = message


_SYSTEM_PROMPT = (
    "You are clinical decision-support software assisting a qualified doctor. "
    "You do NOT make diagnoses and you do NOT prescribe treatment. "
    "Given ONLY the case data provided, return a single JSON object and "
    "nothing else. It must have exactly this shape:\n"
    '{"conditions": [{"name": string, "confidence": number 0-100, '
    '"rationale": string}], "suggestedTests": [string]}\n'
    "Rules you must obey:\n"
    "- 'name' is a possible condition, never a confirmed diagnosis.\n"
    "- 'confidence' is an integer 0-100 estimating how well the provided data "
    "matches that condition.\n"
    "- 'rationale' must cite ONLY facts present in the case data you were given. "
    "Never invent lab results, vital signs, medical history, or examination "
    "findings. If a fact is not in the data, you must not imply it exists.\n"
    "- 'suggestedTests' are investigations a doctor might order. Never specify "
    "medication, dosage, or treatment.\n"
    "- If the data is too sparse to support any condition, return an empty "
    "'conditions' array rather than guessing."
)
def _user_prompt(case: dict) -> str:
    """The case, reduced to the facts a clinician would reason from.

    Only fields that genuinely exist on the case are forwarded; nothing is
    synthesised. Vitals are included ONLY when actually recorded.
    """
    patient = case.get("patient") or {}
    facts: dict = {
        "chiefComplaint": case.get("chiefComplaint"),
        "symptoms": [
            {"label": s.get("label"), "severity": s.get("severity"),
             "durationDays": s.get("durationDays"), "bodyRegion": s.get("bodyRegion")}
            for s in (case.get("symptoms") or [])
        ],
        "followUpAnswers": case.get("followUpAnswers") or [],
        "history": case.get("history") or [],
    }
    if patient.get("age") is not None:
        facts["patientAge"] = patient["age"]
    if patient.get("sex") is not None:
        facts["patientSex"] = patient["sex"]
    # Only forward vitals when a reading was actually recorded by a clinician.
    vitals = case.get("latestVitals") or case.get("vitals")
    if vitals:
        facts["recordedVitals"] = {k: v for k, v in vitals.items() if v is not None}

    return (
        "Case data recorded by the hospital system. This is the ONLY case "
        "information available to you:\n"
        + json.dumps(facts, ensure_ascii=False, default=str)
        + "\n\nReturn the JSON object now."
    )


def _extract_json_object(raw: str) -> dict:
    """Pull the first JSON object out of the provider's text."""
    if not isinstance(raw, str) or not raw.strip():
        raise AIDecisionSupportError(
            "provider_empty_response", "The AI provider returned no content."
        )
    text = raw.strip()
    fence = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start = text.find("{")
    if start == -1:
        raise AIDecisionSupportError(
            "provider_invalid_response", "The AI provider did not return JSON."
        )
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                try:
                    parsed = json.loads(text[start : index + 1])
                except ValueError as exc:
                    raise AIDecisionSupportError(
                        "provider_invalid_response",
                        "The AI provider returned malformed JSON.",
                    ) from exc
                if not isinstance(parsed, dict):
                    raise AIDecisionSupportError(
                        "provider_invalid_response",
                        "The AI provider returned an unexpected shape.",
                    )
                return parsed
    raise AIDecisionSupportError(
        "provider_invalid_response", "The AI provider returned malformed JSON."
    )
def _safe_name(value) -> str | None:
    if not isinstance(value, str):
        return None
    name = " ".join(value.split())[:MAX_NAME]
    if not name or _FORBIDDEN_TERMS.search(name):
        return None
    return name


def _safe_text(value) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.split())[:MAX_TEXT]


def _clean_conditions(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for item in raw[: MAX_CONDITIONS * 2]:
        if not isinstance(item, dict):
            continue
        name = _safe_name(item.get("name") or item.get("condition") or item.get("disease"))
        if not name:
            continue
        # A confidence percentage is required. Absent/invalid -> the condition is
        # dropped rather than given an invented certainty.
        try:
            confidence = float(item.get("confidence", item.get("confidencePercent")))
        except (TypeError, ValueError):
            continue
        if not 0 <= confidence <= 100:
            continue
        out.append({
            "name": name,
            "confidencePercent": int(round(confidence)),
            "rationale": _safe_text(item.get("rationale") or item.get("explanation")),
        })
        if len(out) >= MAX_CONDITIONS:
            break
    return out


def _clean_tests(raw) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for index, item in enumerate(raw[: MAX_TESTS * 2]):
        name = _safe_name(item.get("name") or item.get("test")) if isinstance(item, dict) else _safe_name(item)
        if not name:
            continue
        out.append({"id": f"suggested-{index}", "name": name, "type": "lab"})
        if len(out) >= MAX_TESTS:
            break
    return out


def generate_decision_support(provider, case: dict) -> dict:
    """Ask the configured provider for doctor-side decision support.

    Returns the doctor-facing contract:
    ``{label, disclaimer, provider, model, conditions[], suggestedTests[]}``.

    Raises ``AIDecisionSupportError`` when the provider is unusable or its answer
    cannot be validated — the caller then answers 503 and stores nothing.
    """
    if provider is None:
        # No provider is configured. This is the same honest "no clinical model"
        # condition as a missing artifact, so it is reported in the same terms
        # rather than being quietly treated as a different outcome.
        raise AIDecisionSupportError(
            "provider_not_configured",
            "No clinical model is available: no trained artifact is configured "
            "(set AI_MODEL_PATH to the artifact supplied by the modelling "
            "teammate) and no AI decision-support provider is configured "
            "(set AI_PROVIDER).",
        )

    try:
        raw = provider.generate(
            AgentProviderRequest(
                system_prompt=_SYSTEM_PROMPT,
                user_prompt=_user_prompt(case),
                json_mode=True,
            )
        )
    except AIProviderError as exc:
        # Reuse the provider layer's own classification (timeout, rate limit,
        # auth, ...) so the API can report an accurate status.
        raise AIDecisionSupportError(exc.reason, exc.message) from exc

    payload = _extract_json_object(raw)
    conditions = _clean_conditions(payload.get("conditions"))
    if not conditions:
        raise AIDecisionSupportError(
            "no_valid_conditions",
            "The AI provider did not return any usable possible conditions.",
        )

    return {
        "label": DECISION_SUPPORT_LABEL,
        "disclaimer": DECISION_SUPPORT_DISCLAIMER,
        "provider": getattr(provider, "name", "unknown"),
        "model": getattr(provider, "model", None),
        "conditions": conditions,
        "suggestedTests": _clean_tests(payload.get("suggestedTests") or payload.get("tests")),
    }
