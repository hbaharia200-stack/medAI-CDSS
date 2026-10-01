"""Typed boundaries shared by the future clinical AI adapter and presenters.

The modelling teammate owns the implementation that will produce
``ClinicalModelResult``. This module intentionally contains contracts only.
"""
from __future__ import annotations

from typing import Literal, TypedDict


class ClinicalTest(TypedDict):
    id: str
    name: str
    type: Literal["lab", "vital"]


class ClinicalPrediction(TypedDict):
    disease: str
    confidence: float


class ClinicalModelResult(TypedDict):
    predictions: list[ClinicalPrediction]
    recommendedTests: list[ClinicalTest]


class PatientAgentResponse(TypedDict, total=False):
    status: Literal["ok", "model_unavailable"]
    reply: str
    possibleConditions: list[dict]
    disclaimer: str
    actions: list[str]
    #: Which provider actually answered. Diagnostics only — clients may ignore it.
    providerStatus: str
    #: Set when a deterministic red-flag guardrail escalated the reply.
    emergency: bool
    #: Language the reply was generated in ("en" | "sw").
    language: str
    #: Patient-facing estimated cost. Present only when real, configured
    #: pricing data exists — never derived from the language model.
    costEstimate: dict
    #: Nearby facility + travel time. Present only when a deterministic
    #: location service resolved a real place.
    hospital: dict
    #: Ask the patient to rate the service at the end of the journey.
    askFeedback: bool
