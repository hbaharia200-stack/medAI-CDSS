"""Normalize raw model predictions into the frontend's AIRecommendation shape.

Frontend contract (``shared-types/caseTypes.ts`` AIRecommendation):
  { diseaseName, confidence:'High'|'Medium'|'Low', confidenceScore?,
    topSymptomsSummary, reasoningFactors[], recommendedTests:[{id,name}] }

AI output is clinical DECISION SUPPORT, never an autonomous final diagnosis.
"""
from __future__ import annotations

from collections import OrderedDict

from .feature_engine import DEFAULT_DISEASE_TESTS


def _to_confidence_level(score: float, high_t: float, med_t: float) -> str:
    if score >= high_t:
        return "High"
    if score >= med_t:
        return "Medium"
    return "Low"


def _lookup_tests(disease_name: str) -> list[dict]:
    key = disease_name.strip().lower()
    names = DEFAULT_DISEASE_TESTS.get(key, [])
    return [{"id": f"test-{i}", "name": n, "type": "lab"} for i, n in enumerate(names)]


def _summarize_symptoms(symptoms: list[dict]) -> str:
    if not symptoms:
        return "No specific symptoms reported."
    return ", ".join(s.get("label") or "" for s in symptoms)


def normalize_predictions(
    predictions: list[dict],
    *,
    case_dict: dict,
    high_t: float = 0.80,
    med_t: float = 0.55,
    top_k: int = 3,
    model_version: str | None = None,
) -> list[dict]:
    """Convert adapter predictions into frontend-shaped recommendations.

    Args:
        predictions: list of {'label': str, 'score': float, 'raw': dict} as
            produced by a ModelAdapter.
        case_dict: serialized case (for symptoms/history summary + test lookup).
        high_t/med_t: 0..1 confidence thresholds.
    """
    symptoms = case_dict.get("symptoms") or []
    symptom_summary = _summarize_symptoms(symptoms)
    history_snippets = list(case_dict.get("history") or [])

    out: list[dict] = []
    # Sort by score desc and cap to top_k.
    ranked = sorted(predictions, key=lambda p: float(p.get("score", 0.0)), reverse=True)[:top_k]

    for idx, pred in enumerate(ranked):
        label = str(pred.get("label", f"condition_{idx}"))
        score = float(pred.get("score", 0.0))

        # If the raw model output already carries the structured fields we need,
        # honour them (the model is the source of truth when it provides them).
        raw = pred.get("raw") or {}
        recommended_tests = raw.get("recommended_tests") or _lookup_tests(label)
        reasoning = raw.get("reasoning_factors") or []
        if not reasoning:
            # Fallback human-readable reasoning synthesized from the case.
            reasoning = [f"Top symptom: {symptom_summary}."]
            if history_snippets:
                reasoning.append(f"Relevant history: {'; '.join(history_snippets)[:120]}.")
            reasoning.append(f"Model confidence for {label}: {round(score * 100)}%.")

        out.append({
            "diseaseName": label,
            "confidence": _to_confidence_level(score, high_t, med_t),
            "confidenceScore": round(score, 4),
            "topSymptomsSummary": raw.get("top_symptoms_summary") or symptom_summary,
            "reasoningFactors": list(reasoning),
            "recommendedTests": recommended_tests,
            # Internal (saved to DB, stripped before sending to the frontend
            # when AI_OUTPUT_MODE=full). Kept here so the service layer can
            # persist provenance alongside the recommendation.
            "_raw": raw,
            "_model_version": model_version,
        })

    return out


def strip_internal(rec: dict) -> dict:
    """Remove backend-only keys before sending a recommendation to the client."""
    clean = OrderedDict(rec)
    clean.pop("_raw", None)
    clean.pop("_model_version", None)
    return dict(clean)
