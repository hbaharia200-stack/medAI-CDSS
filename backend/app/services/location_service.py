"""Deterministic patient location, nearby-facility and travel-time service.

Design rule, and the reason this module exists at all: **the language model
never supplies a hospital, a distance, or a travel time.** Those are logistics
facts, and a plausible-sounding guess is worse than an honest "unavailable".

The intended pipeline is:

    patient location -> location service -> nearest appropriate facility
                     -> routing service -> travel time -> agent response/UI

Every stage has a real boundary here, and every stage returns ``None`` when its
data source is not configured. The agent then omits the corresponding field
entirely rather than filling it in.

To plug in a real provider later, add a branch to :func:`find_nearby` (Places /
geocoding) and :func:`travel_estimate` (Directions / routing). No other module,
and no client, needs to change.
"""
from __future__ import annotations

import math

from flask import current_app


def _cfg(key: str, default=None):
    try:
        return current_app.config.get(key, default)
    except RuntimeError:
        return default


#: Facilities the deterministic location service can resolve.
#: Populated only from real, operator-configured data — never invented.
HOSPITALS: list[dict] = []


def is_configured() -> bool:
    return bool(_cfg("LOCATION_ENABLED", False)) and bool(HOSPITALS)


def find_nearby(latitude: float, longitude: float) -> dict | None:
    """Return the nearest configured facility, or None.

    Straight-line distance is only ever used to *rank* real, configured
    facilities. It is never reported to the patient as a travel distance,
    because a straight line is not a road route.
    """
    if not is_configured():
        return None
    nearest = None
    nearest_d = None
    for entry in HOSPITALS:
        try:
            d = _haversine_km(
                latitude, longitude, float(entry["latitude"]), float(entry["longitude"])
            )
        except (KeyError, TypeError, ValueError):
            continue  # a malformed entry is skipped, never guessed at
        if nearest_d is None or d < nearest_d:
            nearest, nearest_d = entry, d
    if nearest is None:
        return None
    return {
        "id": str(nearest["id"]).strip(),
        "name": str(nearest["name"]).strip(),
        "latitude": nearest["latitude"],
        "longitude": nearest["longitude"],
    }


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(d_lambda / 2) ** 2
    return 2 * radius_km * math.asin(math.sqrt(a))


def travel_estimate(origin: dict, destination: dict) -> dict | None:
    """Route/duration from a configured routing provider.

    Returns None unless a real provider is configured. Straight-line
    distance is deliberately NOT returned as a travel time: guessing minutes
    from crow-flies would be fabricating clinical logistics.
    """
    return None
