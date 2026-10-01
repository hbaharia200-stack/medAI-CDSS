"""AI provider abstraction for the patient agent.

The patient agent talks to a *provider*, never to a vendor SDK. That is what
lets the modelling teammate's clinical API be swapped in without touching the
mobile/web clients.

Contract
--------
A provider's only job is: given a system prompt and a user prompt, return the
assistant's raw text. Everything else — prompt construction, JSON validation,
medical-safety enforcement, persistence — stays in ``agent_service``. A provider
must never be trusted to police clinical safety.

Adding a provider
-----------------
1. Subclass :class:`AIProvider`.
2. Register it in ``app/services/ai/__init__.py``.
3. Select it with ``AI_PROVIDER=<name>``.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


class AIProviderError(RuntimeError):
    """A provider failure, classified so the API can answer predictably.

    ``reason`` is a small, stable, non-sensitive code. It is safe to log and
    safe to expose; it never contains an API key, URL or stack trace.
    """

    #: No provider is configured at all (no key / AI_PROVIDER unset).
    NOT_CONFIGURED = "provider_not_configured"
    #: The provider rejected our credentials.
    AUTH_FAILED = "provider_auth_failed"
    #: The provider is rate limiting us.
    RATE_LIMITED = "provider_rate_limited"
    #: The provider did not answer within the deadline.
    TIMEOUT = "provider_timeout"
    #: The provider is reachable but failing / 5xx / model missing.
    UNAVAILABLE = "provider_unavailable"
    #: The provider answered, but not with anything we can validate.
    INVALID_RESPONSE = "provider_invalid_response"
    #: Transport-level failure (DNS, TLS, connection reset).
    NETWORK = "provider_network_error"

    def __init__(self, reason: str, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.reason = reason
        self.message = message
        # HTTP status we saw, if any. Used for logging only.
        self.status_code = status_code

    def __str__(self) -> str:  # keeps logs free of provider payloads
        return f"{self.reason}: {self.message}"


@dataclass(frozen=True)
class AgentProviderRequest:
    """Everything a provider is allowed to see.

    Deliberately narrow: no patient ids, no database handles, no attachments'
    bytes. The agent only ever forwards what the patient/system already
    supplied, so a provider cannot invent access to clinical records.
    """

    system_prompt: str
    user_prompt: str
    #: Ask the provider for a JSON object rather than prose, when it supports it.
    json_mode: bool = True


class AIProvider(ABC):
    """Base class for every agent provider."""

    #: Stable identifier used by ``AI_PROVIDER``.
    name: str = "base"

    @abstractmethod
    def available(self) -> tuple[bool, str | None]:
        """Return ``(usable, reason_if_not)`` without performing any network I/O."""

    @abstractmethod
    def generate(self, request: AgentProviderRequest) -> str:
        """Return the assistant's raw text.

        Raises:
            AIProviderError: on any failure, classified via ``reason``.
        """

    def describe(self) -> dict:
        """Safe, non-sensitive description for ``/api/health`` style output."""
        usable, reason = self.available()
        return {"provider": self.name, "available": usable, "reason": reason}
