"""Symptom extraction (``POST /api/nlp/extract``) for the mobile intake chat.

HONESTY CONTRACT (project rule: never fake AI):
  * No trained NLP artifact exists in this repository. Unless one is configured
    via ``AI_NLP_MODEL_PATH`` *and* an NLP adapter is implemented, this service
    raises ``AIModelNotConfigured`` → the endpoint answers 503. It never
    pretends a model produced the output.
  * A deterministic, rule-based keyword extractor is available for development
    so the mobile flow can be exercised end-to-end. It is OFF by default and,
    when enabled (``NLP_ALLOW_RULE_BASED_FALLBACK=true``), every response is
    labelled ``modelBacked: false`` with ``method: "rule_based_keywords"``.
"""
from __future__ import annotations

from flask import current_app

from app.ai import AIModelNotConfigured

# Bilingual (Swahili/English) keyword table -> canonical symptom label.
# This is a UI-assist dictionary, NOT a trained model.
KEYWORDS: dict[str, tuple[str, ...]] = {
    "Fever": ("fever", "homa", "hot body", "moto wa mwili"),
    "Headache": ("headache", "head pain", "maumivu ya kichwa", "kichwa"),
    "Cough": ("cough", "kikohozi", "coughing"),
    "Chest pain": ("chest pain", "maumivu ya kifua", "kifua"),
    "Shortness of breath": ("shortness of breath", "breathless", "kupumua kwa shida", "kushindwa kupumua"),
    "Fatigue": ("fatigue", "tired", "weakness", "uchovu", "udhaifu"),
    "Nausea": ("nausea", "kichefuchefu"),
    "Vomiting": ("vomit", "vomiting", "kutapika", "tapika"),
    "Abdominal pain": ("stomach", "abdominal", "belly", "maumivu ya tumbo", "tumbo"),
    "Diarrhea": ("diarrhea", "diarrhoea", "kuhara"),
    "Dizziness": ("dizzy", "dizziness", "kizunguzungu"),
    "Chills": ("chills", "kutetemeka", "baridi"),
    "Night sweats": ("night sweats", "jasho la usiku"),
    "Sore throat": ("sore throat", "maumivu ya koo", "koo"),
    "Joint pain": ("joint pain", "maumivu ya viungo", "viungo"),
    "Rash": ("rash", "vipele", "upele"),
    "Back pain": ("back pain", "maumivu ya mgongo", "mgongo"),
}

# Suggested body regions for the body-map UI (display hint only).
BODY_REGIONS = {
    "Headache": "Head",
    "Fever": "Whole body",
    "Cough": "Chest",
    "Chest pain": "Chest",
    "Shortness of breath": "Chest",
    "Fatigue": "Whole body",
    "Nausea": "Abdomen",
    "Vomiting": "Abdomen",
    "Abdominal pain": "Abdomen",
    "Diarrhea": "Abdomen",
    "Dizziness": "Head",
    "Chills": "Whole body",
    "Night sweats": "Whole body",
    "Sore throat": "Throat",
    "Joint pain": "Joints",
    "Rash": "Skin",
    "Back pain": "Back",
}

DEFAULT_SEVERITY = 3


def _cfg(key: str, default=None):
    try:
        return current_app.config.get(key, default)
    except RuntimeError:
        return default


def nlp_model_path() -> str:
    return (_cfg("AI_NLP_MODEL_PATH", "") or "").strip()


def rule_based_enabled() -> bool:
    return bool(_cfg("NLP_ALLOW_RULE_BASED_FALLBACK", False))


def status() -> dict:
    return {
        "modelConfigured": bool(nlp_model_path()),
        "ruleBasedFallbackEnabled": rule_based_enabled(),
        "available": rule_based_enabled(),
        "note": (
            "No trained NLP artifact is bundled with this repository. "
            "Symptom extraction is unavailable until one is configured and an "
            "NLP adapter is implemented (tracked as BLOCKED in the report)."
        ),
    }


def rule_based_extract(text: str) -> list[dict]:
    """Deterministic keyword match over the patient's free text."""
    haystack = (text or "").lower()
    found: list[dict] = []
    for label, tokens in KEYWORDS.items():
        for token in tokens:
            if token in haystack:
                found.append({
                    "id": f"sym-{label.lower().replace(' ', '-')}",
                    "label": label,
                    "bodyRegion": BODY_REGIONS.get(label),
                    "severity": None,
                    "durationDays": None,
                    "notes": f"matched phrase: '{token}'",
                })
                break
    return found


def extract(text: str) -> tuple[list[dict], dict]:
    """Return ``(symptoms, meta)``.

    Raises:
        AIModelNotConfigured: when no NLP model is available/enabled.
    """
    if nlp_model_path():
        # Configured but not wired: refuse to guess rather than pretend.
        raise AIModelNotConfigured(
            "An NLP model path is configured but this revision has no NLP adapter "
            "implemented for it. Symptom extraction is disabled instead of "
            "returning unverified output."
        )
    if not rule_based_enabled():
        raise AIModelNotConfigured(
            "No NLP model is configured. Set AI_NLP_MODEL_PATH to a trained "
            "artifact, or enable NLP_ALLOW_RULE_BASED_FALLBACK=true to use the "
            "deterministic keyword extractor in development."
        )

    symptoms = rule_based_extract(text)
    meta = {
        "modelBacked": False,
        "method": "rule_based_keywords",
        "disclaimer": (
            "Rule-based keyword extraction for development only — NOT the trained "
            "model. Confirm every symptom with the patient before clinical use."
        ),
        "language": "sw-en",
    }
    return symptoms, meta