"""Application configuration.

The backend is designed for PostgreSQL in production (read from DATABASE_URL).
For local development / CI where no PostgreSQL server is available, point
DATABASE_URL at SQLite instead — the whole stack (SQLAlchemy, Alembic, models)
is dialect-agnostic.
"""
from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def _get(key: str, default: str | None = None) -> str | None:
    return os.environ.get(key, default)


def _bool(key: str, default: bool = False) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


class Config:
    """Base configuration shared by all environments."""

    # --- Core Flask -------------------------------------------------------
    SECRET_KEY = _get("SECRET_KEY", "dev-only-not-for-production")
    API_PREFIX = "/api"

    # --- Database ---------------------------------------------------------
    SQLALCHEMY_DATABASE_URI = _get("DATABASE_URL", "postgresql+psycopg2://medai:medai@localhost:5432/medai")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"echo": _bool("SQLALCHEMY_ECHO", False)}

    # --- JWT --------------------------------------------------------------
    JWT_SECRET_KEY = _get("JWT_SECRET_KEY", os.environ.get("SECRET_KEY", "dev-only-not-for-production"))
    access_exp = int(_get("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "30"))
    refresh_exp = int(_get("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "7"))
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=access_exp)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=refresh_exp)
    JWT_TOKEN_LOCATION = ("headers", "cookies")
    JWT_COOKIE_CSRF_PROTECT = False  # API-first: clients send Bearer tokens.

    # --- CORS -------------------------------------------------------------
    cors_origins_raw = _get("CORS_ORIGINS", "http://localhost:4000,http://localhost:5173,http://localhost:8081")
    CORS_ORIGINS = [o.strip() for o in cors_origins_raw.split(",") if o.strip()]

    # --- AI model ---------------------------------------------------------
    AI_MODEL_PATH = _get("AI_MODEL_PATH", "")
    AI_FEATURE_SCHEMA_PATH = _get("AI_FEATURE_SCHEMA_PATH", "")
    AI_MODEL_FORMAT = _get("AI_MODEL_FORMAT", "auto")
    AI_CONFIDENCE_HIGH = float(_get("AI_CONFIDENCE_HIGH", "0.80"))
    AI_CONFIDENCE_MEDIUM = float(_get("AI_CONFIDENCE_MEDIUM", "0.55"))
    AI_RECOMMENDATION_TOP_K = int(_get("AI_RECOMMENDATION_TOP_K", "3"))

    # --- NLP (mobile symptom extraction) ----------------------------------
    # The trained NLP artifact (if any) is supplied separately from the
    # diagnosis model. Until it is configured, /api/nlp/extract answers 503.
    AI_NLP_MODEL_PATH = _get("AI_NLP_MODEL_PATH", "")
    NLP_ALLOW_RULE_BASED_FALLBACK = _bool("NLP_ALLOW_RULE_BASED_FALLBACK", False)

    # --- Patient agent AI provider ----------------------------------------
    # Which adapter answers POST /api/agent/chat. The DEFAULT IS EMPTY, which
    # is deliberate: with no provider the endpoint keeps its honest
    # "model_unavailable" response, and the test suite never needs the network.
    #
    #   AI_PROVIDER unset | none | unavailable  -> no provider
    #   AI_PROVIDER=teammate                    -> clinical API (teammate-owned)
    AI_PROVIDER = _get("AI_PROVIDER", "").strip().lower()

    # --- Doctor-side clinical decision support -----------------------------
    # The doctor Diagnosis screen reads `POST /api/cases/<id>/ai-recommendation`.
    # That endpoint prefers the trained artifact (AI_MODEL_PATH) and otherwise
    # falls back to the configured AI provider, validated server-side by
    # app/services/ai/decision_support.py.
    #
    # Set to "model_only" to keep the strict historical behaviour (503 unless
    # the teammate's trained artifact is configured), or "provider" to allow the
    # teammate model to produce structured decision support once it is wired in.
    # The default "auto" allows the provider fallback only when no artifact is
    # configured, so the real model always wins when it exists.
    AI_DECISION_SUPPORT = _get("AI_DECISION_SUPPORT", "auto").strip().lower()

    # --- Patient cost estimate ---------------------------------------------
    # A patient-facing price estimate is ONLY produced when real pricing is
    # configured. There is deliberately no default price: with nothing
    # configured the agent returns no cost section at all rather than an
    # invented TZS figure.
    COST_ESTIMATES_ENABLED = _bool("COST_ESTIMATES_ENABLED", False)
    TEST_PRICE_TZS = _get("TEST_PRICE_TZS", "")

    # --- Patient location / nearby hospital / travel time ------------------
    # Requires a real maps provider (Places + Directions) plus a real facility
    # list. With no provider configured the agent omits the hospital and
    # travel-time sections entirely — it never guesses a hospital, a distance
    # in km, or a duration in minutes.
    LOCATION_ENABLED = _bool("LOCATION_ENABLED", False)
    LOCATION_PROVIDER = _get("LOCATION_PROVIDER", "").strip().lower()
    LOCATION_API_KEY = _get("LOCATION_API_KEY", "").strip()

    # --- Product switches -------------------------------------------------
    # Appointment booking is public by design (the marketing landing page has no
    # account). Set to false to require authentication on POST /api/appointments.
    APPOINTMENTS_PUBLIC_BOOKING = _bool("APPOINTMENTS_PUBLIC_BOOKING", True)
    # Booking window in days (validation guard) and default consultation fee.
    APPOINTMENT_MAX_DAYS_AHEAD = int(_get("APPOINTMENT_MAX_DAYS_AHEAD", "180"))
    APPOINTMENT_DEFAULT_FEES = float(_get("APPOINTMENT_DEFAULT_FEES", "0"))

    # --- Misc -------------------------------------------------------------
    PROPAGATE_EXCEPTIONS = _bool("PROPAGATE_EXCEPTIONS", False)


class DevelopmentConfig(Config):
    DEBUG = True
    ENV = "development"
    DEV_SEED_USERS_ENABLED = True
    # Exact local Expo origins only; explicit overrides and production are unchanged.
    CORS_ORIGINS = [o.strip() for o in _get(
        "CORS_ORIGINS",
        "http://localhost:4000,http://localhost:5173,http://localhost:8081,http://localhost:8082",
    ).split(",") if o.strip()]
    SQLALCHEMY_DATABASE_URI = _get(
        "DATABASE_URL",
        f"sqlite:///{Path(__file__).resolve().parents[1] / 'instance' / 'medai-dev.sqlite3'}",
    )


class ProductionConfig(Config):
    DEBUG = False
    ENV = "production"
    PROPAGATE_EXCEPTIONS = False
    DEV_SEED_USERS_ENABLED = False


class TestingConfig(Config):
    """Used by the pytest suite. Forces an in-memory SQLite database so tests
    run with no external services (PostgreSQL is covered by the dialect-agnostic
    config above for real deployments)."""

    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {"echo": False}
    JWT_SECRET_KEY = "test-jwt-secret"
    SECRET_KEY = "test-secret"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=60)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=1)
    AI_MODEL_PATH = ""  # no model in unit tests; injected via DI instead
    DEV_SEED_USERS_ENABLED = False


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}


def get_config() -> type[Config]:
    env = os.environ.get("FLASK_ENV", "default")
    return config.get(env, config["default"])
