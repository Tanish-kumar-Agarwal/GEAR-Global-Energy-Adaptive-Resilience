"""Live market prices from the EIA API v2 (api.eia.gov).

Reads EIA_API_KEY from the environment (or apps/api/.env, which is
gitignored). Without a key, callers get None and the route reports
data_unavailable instead of inventing numbers. Responses are cached
in-process so the free EIA quota is not burned on every dashboard poll.
"""

import json
import logging
import os
import ssl
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

# Python installs without system CA certificates (common on macOS) fail TLS
# verification against api.eia.gov; certifi's bundle fixes that when present.
try:
    import certifi
    _SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CONTEXT = ssl.create_default_context()

logger = logging.getLogger(__name__)

EIA_BASE = "https://api.eia.gov/v2"
REQUEST_TIMEOUT_S = 15
CACHE_TTL_S = 15 * 60

# route -> [(series id, display name)]. Series units differ (bbl, MMBtu, gal)
# exactly as trading desks quote them.
EIA_SERIES: Dict[str, List[tuple]] = {
    "petroleum/pri/spt": [
        ("RBRTE", "Brent Crude"),
        ("RWTC", "WTI Crude"),
        ("EER_EPD2DXL0_PF4_Y35NY_DPG", "Diesel (NYH)"),
    ],
    "natural-gas/pri/fut": [
        ("RNGWHHD", "Henry Hub Gas"),
    ],
}

_cache_lock = threading.Lock()
_cache: Dict[str, Any] = {"expires": 0.0, "payload": None}


def _api_key() -> Optional[str]:
    key = os.getenv("EIA_API_KEY")
    if key:
        return key
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line.startswith("EIA_API_KEY="):
                return line.split("=", 1)[1].strip() or None
    return None


def _fetch_route(route: str, series_ids: List[str], key: str) -> List[dict]:
    params = [
        ("api_key", key),
        ("frequency", "daily"),
        ("data[0]", "value"),
        ("sort[0][column]", "period"),
        ("sort[0][direction]", "desc"),
        # Enough rows for latest + previous trading day across every series.
        ("length", str(len(series_ids) * 8)),
    ]
    params += [("facets[series][]", s) for s in series_ids]
    url = f"{EIA_BASE}/{route}/data/?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT_S, context=_SSL_CONTEXT) as resp:
        body = json.load(resp)
    return body.get("response", {}).get("data", [])


def get_live_prices() -> Optional[Dict[str, Any]]:
    """Latest spot price and day-over-day change per series, or None."""
    now = time.time()
    with _cache_lock:
        if _cache["payload"] is not None and now < _cache["expires"]:
            return _cache["payload"]

    key = _api_key()
    if not key:
        logger.info("EIA_API_KEY not configured; market prices unavailable")
        return None

    prices = []
    as_of = ""
    try:
        for route, series in EIA_SERIES.items():
            rows = _fetch_route(route, [s for s, _ in series], key)
            for series_id, display_name in series:
                points = [r for r in rows if r.get("series") == series_id and r.get("value") is not None]
                if not points:
                    continue
                latest = float(points[0]["value"])
                change_pct = None
                if len(points) > 1:
                    prev = float(points[1]["value"])
                    if prev:
                        change_pct = round((latest - prev) / prev * 100, 2)
                as_of = max(as_of, points[0]["period"])
                prices.append({"name": display_name, "price": latest, "change_pct": change_pct})
    except Exception as exc:  # noqa: BLE001 - any upstream failure means "unavailable"
        logger.warning("EIA price fetch failed: %s", exc)
        return None

    if not prices:
        return None

    payload = {"status": "ok", "source": "EIA API v2", "as_of": as_of, "prices": prices}
    with _cache_lock:
        _cache["payload"] = payload
        _cache["expires"] = time.time() + CACHE_TTL_S
    return payload
