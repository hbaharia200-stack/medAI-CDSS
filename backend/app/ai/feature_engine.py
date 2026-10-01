"""Feature preparation for the AI model.

This is the adapter between the clinical domain model and whatever feature
vector the trained model expects. IMPORTANT per project rules: we do NOT invent
the model's feature contract. Instead:

  * If the model artifact exposes ``feature_names_in_`` (sklearn) or a
    ``feature_schema.json`` sidecar is configured, the feature dict produced
    here is ordered/mapped to those exact names — no guessing.
  * If neither is available, ``AIService`` still runs the model (using the
    deterministic sorted-key fallback in the adapter) but logs a prominent
    warning that the feature ordering may not match training time and that a
    real schema must be supplied.

The feature dict is intentionally a plain ``dict[str, float]`` so the loader can
re-order it by name to any schema.
"""
from __future__ import annotations

from collections import OrderedDict


# Default, well-known disease -> recommended-test catalogue. This is a *display
# / safety-net* mapping used only when the model's raw output does not already
# carry recommended tests. It does NOT define the model interface — the model's
# own recommended_tests survive through untouched when present.
DEFAULT_DISEASE_TESTS = {
    "malaria": ["Rapid Diagnostic Test (mRDT)", "Blood smear / microscopy"],
    "typhoid": ["Widal test", "Blood culture"],
    "pneumonia": ["Chest X-ray", "Oxygen saturation (SpO2)"],
    "viral upper respiratory infection": ["Full blood count"],
    "acute coronary syndrome": ["ECG (12-lead)", "Troponin I"],
    "pulmonary embolism": ["D-dimer", "CT pulmonary angiogram"],
    "respiratory tract infection": ["Chest X-ray"],
    "viral bronchitis": ["Full blood count"],
    "peptic ulcer disease": ["H. pylori test (urea breath)", "Upper endoscopy (EGD)"],
    "gastroenteritis": ["Stool culture"],
    "hypertension": ["Blood pressure monitoring"],
    "diabetes": ["Blood glucose / HbA1c"],
}


def _symptom_presence_flags(symptoms: list[dict]) -> dict:
    """Presence (1/0) + max-severity for known chief-symptom tokens."""
    flags: dict[str, float] = OrderedDict()
    labels = " ".join((s.get("label") or "") for s in symptoms).lower()
    for token in (
        "fever", "headache", "fatigue", "cough", "chest pain", "chest", "pain",
        "shortness of breath", "breathlessness", "nausea", "vomiting", "stomach",
        "abdominal", "dizziness", "weakness", "chills", "night sweats",
    ):
        key = "symptom_" + token.replace(" ", "_")
        flags[key] = 1.0 if token in labels else 0.0

    # Max severity across reported symptoms (1-5).
    sevs = [float(s.get("severity")) for s in symptoms if isinstance(s.get("severity"), (int, float))]
    flags["symptom_max_severity"] = max(sevs) if sevs else 0.0
    flags["symptom_count"] = float(len(symptoms))
    return flags


def build_case_features(case_dict: dict) -> dict:
    """Build a named feature dict from a serialized case for the model.

    ``case_dict`` is the serialized case (patient + symptoms + vitals + history).
    Returns an OrderedDict of float features.
    """
    features: dict[str, float] = OrderedDict()

    patient = case_dict.get("patient") or {}
    age = patient.get("age")
    if isinstance(age, (int, float)):
        features["age"] = float(age)
    sex = (patient.get("sex") or "").upper()
    features["sex_male"] = 1.0 if sex == "M" else 0.0
    features["sex_female"] = 1.0 if sex == "F" else 0.0

    v = case_dict.get("vitals") or {}
    vitals_map = {
        "temperatureC": "vital_temperature_c",
        "bloodPressureSystolic": "vital_bp_systolic",
        "bloodPressureDiastolic": "vital_bp_diastolic",
        "heartRate": "vital_heart_rate",
        "respiratoryRate": "vital_resp_rate",
        "oxygenSaturation": "vital_spo2",
        "weightKg": "vital_weight_kg",
    }
    for src_key, feat_key in vitals_map.items():
        val = v.get(src_key)
        features[feat_key] = float(val) if isinstance(val, (int, float)) else 0.0

    symptoms = case_dict.get("symptoms") or []
    features.update(_symptom_presence_flags(symptoms))

    # Derived urgency / burden signals.
    features["urgent_flag"] = 1.0 if case_dict.get("urgent") else 0.0
    features["history_count"] = float(len(case_dict.get("history") or []))

    return features
