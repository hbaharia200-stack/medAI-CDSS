"""Patient-facing estimated cost.

Design rule: **the language model never states a price.** It has no access to
clinic pricing and will happily invent a plausible TZS figure, which for a
low-literacy patient is indistinguishable from a real quote.

Cost is only ever reported when it can be derived from real, configured data:

* ``TEST_PRICE_TZS`` — an operator-supplied price for the recommended tests.
  Until this is set the service reports "unavailable".
* A patient's own past ``InvoiceLine`` rows can be used as a historical
  reference by a future version of :func:`estimate_for_case`.

To plug pricing in, either set ``TEST_PRICE_TZS`` or extend
:func:`estimate_for_case` to read the clinic's price table. The agent contract
does not change: ``costEstimate`` is simply absent while there is no data.
"""
from __future__ import annotations

from flask import current_app

#: Human-readable reason codes the client can translate.
UNAVAILABLE_NO_PRICING = "cost_pricing_not_configured"


def _cfg(key: str, default=None):
    try:
        return current_app.config.get(key, default)
    except RuntimeError:
        return default


def is_configured() -> bool:
    return _cfg("COST_ESTIMATES_ENABLED", False) and _configured_price() is not None


def _configured_price():
    try:
        price = float(_cfg("TEST_PRICE_TZS", 0) or 0)
    except (TypeError, ValueError):
        return None
    return price if price > 0 else None


def estimate_for_case(case, condition_count: int = 0) -> dict | None:
    """Return a cost estimate, or ``None`` when no real pricing exists.

    Always labelled as an estimate by the contract, and never rounded into
    false precision.
    """
    if not is_configured():
        return None
    unit = _configured_price()
    if unit is None:
        return None
    # A real quote needs a real basket of tests. Until the clinic supplies
    # per-condition test baskets, the only defensible figure is the configured
    # unit price for a single consultation-grade test, presented as a range so
    # it cannot be read as a firm quote.
    low = unit
    high = round(unit * max(1, condition_count) * 1.25, -2) if condition_count else unit
    return {
        "currency": "TZS",
        "isEstimate": True,
        "low": int(low),
        "high": int(high),
    }
