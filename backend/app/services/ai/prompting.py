"""Prompt construction and *server-side* validation for the patient agent.

Medical-safety note
-------------------
Nothing here trusts the model. The prompt is best-effort guidance; the
guarantees are enforced in :func:`validate_agent_reply`, which runs on every
provider response and can only ever emit the keys the existing mobile/web
contract already understands. A provider, including the teammate's clinical API later, cannot widen that
surface.

Guarantees applied regardless of the provider:
  * ``status`` is set by us, never by the model;
  * ``disclaimer`` is our wording, never the model's;
  * unknown keys are dropped;
  * ``possibleConditions`` entries need a name and a 0-100 confidence, and are
    presented as *possibilities*, never as a confirmed diagnosis;
  * red-flag symptoms deterministically append escalation advice.
"""
from __future__ import annotations

import json
import re
from typing import Any

#: Actions the clients actually implement (see AgentChatReply.actions).
ALLOWED_ACTIONS = frozenset(
    {
        "show_conditions",
        "find_hospital",
        "show_map",
        "review_case",
        "send_case",
        "book_appointment",
        "rate_service",
    }
)

#: Always attached by the server; never taken from the model.
DISCLAIMER = (
    "This is information to help you decide what to do next — it is not a "
    "medical diagnosis. A healthcare professional makes the final clinical decision."
)

#: Appended deterministically when the patient reports a red-flag symptom.
ESCALATION = (
    "Seek emergency care now — go to the nearest emergency department or call "
    "your local emergency number. Do not wait for this app."
)

# ---------------------------------------------------------------------------
# Language
# ---------------------------------------------------------------------------
# The app language is sent with every agent request and is enforced in two
# independent places, because front-end translation keys alone can never
# localize model-generated prose:
#
#   1. the *prompt* tells the provider which language to answer in, and
#   2. the *server* owns every safety string the patient reads (disclaimer,
#      escalation, unavailable state), so those are never left to the model.
#
# Condition *display* names are produced by the provider in the requested
# language for ANY condition it can name, so this is not a hard-coded disease
# list. The provider also returns a stable canonical ``code`` that backend
# logic, analytics and the teammate clinical model keep using unchanged.
SUPPORTED_LANGUAGES = ("en", "sw")
DEFAULT_LANGUAGE = "en"

#: Provider instruction. Deliberately blunt: the model otherwise drifts back
#: to English, which is unusable for the low-literacy patients this feature
#: is for.
LANGUAGE_DIRECTIVES = {
    "en": (
        "LANGUAGE: You MUST answer entirely in English (Kiswahili is NOT "
        "acceptable). This includes the `reply`, any follow-up question you "
        "ask, and the `displayName` of every possible condition."
    ),
    "sw": (
        "LANGUAGE: You MUST answer entirely in Kiswahili (Swahili). English is "
        "NOT acceptable. Use simple, short sentences and everyday words, "
        "because the patient may have a low level of literacy. This applies "
        "to every part of your answer: the `reply`, any follow-up question, "
        "and the `displayName` of every possible condition. Translate medical "
        "terms into plain Kiswahili a patient would recognise (for example "
        "'tension-type headache' is 'maumivu ya kichwa ya mkazo', 'migraine' "
        "is 'kipandauso', 'dehydration' is 'upungufu wa maji mwilini'). Do not "
        "leave any English words in the text the patient will read."
    ),
}

#: Server-owned patient-visible safety wording, per language. The model never
#: supplies these, so a provider cannot drop or soften them.
LOCALIZED_DISCLAIMER = {
    "en": DISCLAIMER,
    "sw": (
        "Taarifa hizi zinakusaidia uamue hatua inayofuata — si utambuzi wa "
        "ugonjwa. Mtaalamu wa afya ndiye anayefanya uamuzi wa mwisho wa "
        "kimatibabu."
    ),
}

LOCALIZED_ESCALATION = {
    "en": ESCALATION,
    "sw": (
        "Nenda kwa uangalizi wa dharura sasa — nenda kituoni cha dharura "
        "kilicho karibu au piga namba ya dharura ya eneo lako. Usisubiri "
        "programu hii."
    ),
}

#: Shown when no provider could answer. Localized so the patient is never left
#: reading an English system message in a Kiswahili session.
LOCALIZED_UNAVAILABLE = {
    "en": "Clinical AI analysis is not available yet.",
    "sw": "Uchambuzi wa AI za kliniki bado haupatikani.",
}


def normalize_language(raw: str | None) -> str:
    """Map a client-supplied language tag onto a supported one.

    Unknown or missing values fall back to English rather than failing the
    patient's request: the agent must always answer *somewhere*.
    """
    tag = (raw or "").strip().lower().replace("_", "-").split("-")[0]
    return tag if tag in SUPPORTED_LANGUAGES else DEFAULT_LANGUAGE


def language_directive(language: str) -> str:
    return LANGUAGE_DIRECTIVES.get(language, LANGUAGE_DIRECTIVES[DEFAULT_LANGUAGE])


#: Deterministic red-flag terms. Deliberately simple and explainable: a
#: keyword guard is auditable, unlike asking the model whether it is worried.
_EMERGENCY_TERMS = (
    "chest pain", "crushing chest", "can't breathe", "cannot breathe",
    "difficulty breathing", "shortness of breath", "severe bleeding",
    "won't stop bleeding", "unconscious", "not breathing", "seizure",
    "convulsion", "stroke", "face drooping", "slurred speech", "sudden weakness",
    "severe head injury", "coughing blood", "vomiting blood", "stiff neck",
    "suicidal", "suicide", "harm myself", "overdose", "poisoning",
    "kifua", "kupumua", "kutokwa na damu", "kifafa", "kuzirai",
)

_MAX_REPLY_CHARS = 2000
_MAX_CONDITIONS = 5
_MAX_CONDITION_NAME = 80
_MAX_CONDITION_CODE = 64
_MAX_EMERGENCY_SCAN_CHARS = 2000


def contains_emergency_signal(text: str | None) -> bool:
    """True when the patient's own words contain a red-flag term."""
    if not text:
        return False
    lowered = text.lower()[:_MAX_EMERGENCY_SCAN_CHARS]
    return any(term in lowered for term in _EMERGENCY_TERMS)


SYSTEM_PROMPT = f"""You are the MedAI patient assistant in a clinical \
decision-support system for a hospital in Tanzania.

Your role is strictly LIMITED and you must stay inside it:
- You give general, informational guidance and help the patient understand \
what to do next. You NEVER confirm a diagnosis.
- You NEVER present a possible condition as confirmed. Use wording such as \
"possible causes a clinician may consider".
- You DO NOT invent or assume any clinical data. Never state laboratory \
results, test results, vital signs, measurements, medical history, \
prescriptions, medication doses, or decisions made by a doctor. If it was not \
given to you, you do not know it.
- You never tell a patient to stop or change prescribed medication.
- You always encourage the patient to be seen by a nurse or doctor, because a \
clinician reviews every case.
- If the patient describes anything that could be an emergency, tell them to \
seek emergency care immediately and do not delay.

TONE: calm, plain language, short sentences, no jargon, no false reassurance.

Reply with ONE JSON object and nothing else, using exactly these keys:
{{
  "reply": "<2-5 short sentences addressed to the patient>",
  "possibleConditions": [
    {{"code": "<stable_snake_case_identifier>",
      "displayName": "<condition label in the requested language>",
      "confidencePercent": <integer 0-100>}}
  ],
  "actions": ["review_case"]
}}

Rules for the JSON:
- "possibleConditions" may be an empty list when you have too little \
information. At most 5 entries. confidencePercent is your rough uncertainty, \
never a validated probability.
- Each condition has TWO names: "code" is a short, stable, lower_snake_case \
identifier in ENGLISH that never changes with the output language (for example \
"tension_type_headache", "migraine", "dehydration") — it exists so our systems \
can count and group conditions, and it is never shown to the patient. \
"displayName" is the human-readable label in the requested language and IS what \
the patient sees.
- "actions" must be a subset of: {", ".join(sorted(ALLOWED_ACTIONS))}. \
Include "review_case" when the patient should have their case reviewed.
- Never add extra keys. Never wrap the JSON in markdown fences.

You do NOT need to output cost, hospital, travel time or feedback: the server \
computes or omits those itself. Never state a price, a hospital name, a \
distance or a travel time."""


def _strip_code_fences(raw: str) -> str:
    """Tolerate a model that ignores `no markdown` and wraps the JSON."""
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[A-Za-z0-9_-]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()
    return text


def _extract_json_object(raw: str) -> dict:
    """Parse the provider's text into a dict, or raise ValueError.

    Accepts a bare object, a fenced object, or prose surrounding one object.
    Deliberately strict afterwards: the caller validates the schema.
    """
    text = _strip_code_fences(raw)
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    # Fall back to the outermost {...} span (some models add a sentence).
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            parsed = json.loads(text[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    raise ValueError("The provider did not return a JSON object.")


def _clean_reply(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    return text[:_MAX_REPLY_CHARS]


def _slugify_condition_code(value: str) -> str:
    """Normalise a provider-supplied condition identifier.

    The canonical code is what backend logic, analytics and the teammate
    clinical model key on, so it must be a stable, lower-snake identifier with
    no whitespace and no language in it (it is *not* translated).
    """
    slug = re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower()).strip("_")
    return slug[:_MAX_CONDITION_CODE]


def _clean_conditions(value: Any, *, language: str) -> list[dict]:
    """Keep only well-formed entries. Invalid ones are dropped, never invented.

    Each entry carries BOTH a canonical ``code`` (stable, untranslated, used by
    backend logic) and a ``displayName`` (the patient-facing text, produced by
    the provider in the requested language). ``name`` is kept as an alias for
    existing clients that already read it.

    Arbitrary conditions are supported: the code is derived from whatever the
    provider names, so nothing here is a hard-coded disease list.
    """
    if not isinstance(value, list):
        return []
    cleaned: list[dict] = []
    seen_codes: set[str] = set()
    for entry in value:
        if not isinstance(entry, dict):
            continue

        # displayName is preferred; fall back to the legacy `name` key so a
        # provider that only knows the old shape still works.
        display = entry.get("displayName") or entry.get("display_name") or entry.get("name")
        if not isinstance(display, str):
            continue
        display = display.strip()[:_MAX_CONDITION_NAME]
        if not display:
            continue

        raw_confidence = entry.get("confidencePercent", entry.get("confidence"))
        if isinstance(raw_confidence, bool):
            continue
        try:
            confidence = float(raw_confidence)
        except (TypeError, ValueError):
            continue
        if confidence != confidence:  # NaN
            continue
        # Accept either 0-1 or 0-100 from a provider and normalise to 0-100.
        if 0.0 <= confidence <= 1.0:
            confidence *= 100.0
        confidence = max(0.0, min(100.0, confidence))

        # Prefer the provider's own canonical code; otherwise derive one from
        # the display text. Either way the code is language-independent.
        code = entry.get("code")
        code = _slugify_condition_code(code if isinstance(code, str) else display)
        if not code or code in seen_codes:
            continue

        seen_codes.add(code)
        cleaned.append(
            {
                "code": code,
                "displayName": display,
                # Legacy alias kept for the existing mobile/web contract.
                "name": display,
                "confidencePercent": int(round(confidence)),
            }
        )
        if len(cleaned) >= _MAX_CONDITIONS:
            break
    return cleaned


def _clean_actions(value: Any) -> list[str]:
    if not isinstance(value, list):
        return ["review_case"]
    actions = [a for a in value if isinstance(a, str) and a in ALLOWED_ACTIONS]
    # Deduplicate while keeping order; always keep the clinician-review action.
    ordered = list(dict.fromkeys(actions))
    if "review_case" not in ordered:
        ordered.append("review_case")
    return ordered


def validate_agent_reply(
    raw_text: str,
    *,
    patient_message: str | None = None,
    language: str = DEFAULT_LANGUAGE,
) -> dict:
    """Turn untrusted provider text into the existing agent contract.

    ``language`` selects the server-owned safety strings (disclaimer,
    escalation) so they are never left to the provider, which may ignore the
    instruction and answer in English.

    Raises:
        ValueError: when the provider's output cannot be trusted at all (not
            JSON, or no usable ``reply``). The caller converts this into a
            controlled provider error — it is never passed to a patient.
    """
    payload = _extract_json_object(raw_text)

    reply = _clean_reply(payload.get("reply") or payload.get("message"))
    if reply is None:
        raise ValueError("The provider returned no usable reply text.")

    result: dict = {
        # status/disclaimer are ours, not the model's.
        "status": "ok",
        "reply": reply,
        "disclaimer": LOCALIZED_DISCLAIMER.get(language, DISCLAIMER),
        "actions": _clean_actions(payload.get("actions")),
        "language": language,
    }

    conditions = _clean_conditions(payload.get("possibleConditions"), language=language)
    if conditions:
        result["possibleConditions"] = conditions

    if contains_emergency_signal(patient_message):
        # Deterministic guardrail: appended whatever the model decided to say.
        escalation = LOCALIZED_ESCALATION.get(language, ESCALATION)
        result["reply"] = f"{result['reply']}\n\n{escalation}"
        result["actions"] = list(dict.fromkeys([*result["actions"], "find_hospital"]))
        result["emergency"] = True

    return result



def build_user_prompt(
    *,
    message: str,
    case_context: dict | None = None,
    recent_turns: list[dict] | None = None,
    has_attachment: bool = False,
    language: str = DEFAULT_LANGUAGE,
) -> str:
    """Assemble the user turn from *only* data the system already holds.

    The provider is given no database access and no attachment bytes, so it
    cannot invent clinical facts the patient never supplied.

    The language directive goes FIRST and is restated at the end. Repeating it
    matters: the patient's own message often appears earlier in the prompt and
    a model will otherwise mirror the language of the input it was last shown.
    """
    parts: list[str] = [language_directive(language)]

    if case_context:
        parts.append(
            "Case information recorded by the hospital system (this is the only "
            "case data you have):\n"
            + json.dumps(case_context, ensure_ascii=False, default=str)
        )

    if recent_turns:
        rendered = [
            {"role": t.get("role"), "text": (t.get("text") or "")[:400]}
            for t in recent_turns
            if t.get("text")
        ]
        if rendered:
            parts.append(
                "Earlier turns in this same conversation:\n"
                + json.dumps(rendered, ensure_ascii=False)
            )

    parts.append(f"Patient's new message:\n{message or '(no text — an attachment was sent)'}")
    if has_attachment:
        parts.append(
            "The patient attached a file or voice note. Its content is NOT "
            "available to you and has NOT been analysed. Do not describe or "
            "guess what is in it; ask them to describe it in words."
        )
    parts.append(language_directive(language))
    return "\n\n".join(parts)
