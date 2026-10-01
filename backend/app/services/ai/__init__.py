"""Agent AI provider layer.

Public surface used by ``app.services.agent_service``:

    get_provider()  -> the configured AIProvider, or None when unconfigured
    AIProviderError -> classified provider failure
    prompting.*     -> prompt building + server-side output validation

Provider selection is driven by ``AI_PROVIDER``:

    AI_PROVIDER unset / "unavailable"  -> no provider (honest model_unavailable)
    AI_PROVIDER=teammate               -> the clinical API (owned by the modeling teammate)

The default is deliberately "no provider": that keeps the existing verified
behaviour and keeps the test suite independent of the network.
"""
from __future__ import annotations

from flask import current_app

from . import prompting
from .provider import AIProvider, AIProviderError, AgentProviderRequest

__all__ = [
    "AIProvider",
    "AIProviderError",
    "AgentProviderRequest",
    "get_provider",
    "provider_status",
    "prompting",
    "reset_provider_cache",
    "decision_support",
]

# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

#: Names that explicitly mean "no AI provider configured".
_NO_PROVIDER = frozenset({"", "none", "unavailable", "off", "disabled", "null"})


def _cfg(key: str, default=None):
    try:
        return current_app.config.get(key, default)
    except RuntimeError:
        return default


def _build(name: str) -> AIProvider | None:
    """Instantiate a provider by name. Returns None for the disabled state.

    Adding a real provider later means adding one branch here — the API,
    service and clients never change.
    """
    if name in _NO_PROVIDER:
        return None
    if name == "teammate":
        # TEAMMATE AI INTEGRATION POINT (provider registry).
        # Intentionally NOT implemented: the modelling teammate owns that
        # adapter. When it lands, add a branch here returning the clinical
        # provider. Both the patient agent (agent_service) and the doctor-side
        # decision support (recommendation_service) resolve through this same
        # function, so no client changes are needed.
        raise AIProviderError(
            AIProviderError.NOT_CONFIGURED,
            "AI_PROVIDER=teammate was selected but the teammate clinical "
            "adapter has not been provided yet.",
        )
    raise AIProviderError(
        AIProviderError.NOT_CONFIGURED, f"Unknown AI_PROVIDER '{name}'."
    )


# Cached per (provider name, key fingerprint) so a running server never has to
# rebuild the client on every request, while tests can flip config freely.
_CACHE: dict[tuple[str, str], AIProvider | None] = {}


def _cache_key(name: str) -> tuple[str, str]:
    # The provider layer is intentionally key-free: the teammate adapter is
    # supplied by the integration owner and can decide how it stores secrets.
    return (name, "")


def get_provider() -> AIProvider | None:
    """Return the configured provider, or ``None`` when AI is switched off.

    Raises:
        AIProviderError: when a provider is named but cannot be constructed.
    """
    name = (_cfg("AI_PROVIDER", "") or "").strip().lower()
    cache_key = _cache_key(name)
    if cache_key in _CACHE:
        return _CACHE[cache_key]
    provider = _build(name)
    _CACHE[cache_key] = provider
    return provider


def reset_provider_cache() -> None:
    """Drop cached providers (used by tests and config reloads)."""
    _CACHE.clear()


def provider_status() -> dict:
    """Non-sensitive provider description for health/diagnostics."""
    name = (_cfg("AI_PROVIDER", "") or "").strip().lower()
    if name in _NO_PROVIDER:
        return {"provider": None, "available": False, "reason": AIProviderError.NOT_CONFIGURED}
    try:
        provider = get_provider()
    except AIProviderError as exc:
        return {"provider": name, "available": False, "reason": exc.reason}
    if provider is None:
        return {"provider": None, "available": False, "reason": AIProviderError.NOT_CONFIGURED}
    return provider.describe()
