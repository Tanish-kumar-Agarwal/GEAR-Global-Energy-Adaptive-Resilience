"""
Commodity price ingestion.

Prices are the one War Room panel that cannot be derived from our own topology, so they
are ingested as observations with a source and an observation time attached. Nothing is
generated: if a fetch fails the symbol is simply absent and the panel reports it.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from sqlalchemy.orm import Session

from models.domain import MarketPrice

logger = logging.getLogger(__name__)

YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"

# Instruments the War Room tracks. Labels name the actual contract being quoted rather
# than a generic commodity, so the panel never implies a benchmark it is not showing.
TRACKED_INSTRUMENTS = [
    {"symbol": "BRENT", "vendor_symbol": "BZ=F", "name": "Brent Crude (ICE front month)", "unit": "USD/bbl", "commodity_id": "CRUDE_OIL"},
    {"symbol": "WTI", "vendor_symbol": "CL=F", "name": "WTI Crude (NYMEX front month)", "unit": "USD/bbl", "commodity_id": "CRUDE_OIL"},
    {"symbol": "HENRY_HUB", "vendor_symbol": "NG=F", "name": "Natural Gas (Henry Hub)", "unit": "USD/MMBtu", "commodity_id": "LNG"},
    {"symbol": "API2_COAL", "vendor_symbol": "MTF=F", "name": "Coal (API2 Rotterdam)", "unit": "USD/t", "commodity_id": None},
]


class PriceFetchError(RuntimeError):
    pass


class YahooChartAdapter:
    """Public Yahoo Finance chart endpoint. No API key, quote-delayed."""

    source_id = "YAHOO_FINANCE_CHART_V8"

    def __init__(self, instruments: Optional[List[Dict[str, Any]]] = None, timeout: int = 15):
        self.instruments = instruments or TRACKED_INSTRUMENTS
        self.timeout = timeout

    def fetch(self) -> List[Dict[str, Any]]:
        observations = []
        for instrument in self.instruments:
            url = YAHOO_CHART_URL.format(symbol=instrument["vendor_symbol"])
            try:
                response = requests.get(
                    url,
                    params={"interval": "1d", "range": "5d"},
                    headers={"User-Agent": "GEAR/1.0 (market price ingestion)"},
                    timeout=self.timeout,
                )
                response.raise_for_status()
                results = (response.json().get("chart") or {}).get("result")
                if not results:
                    raise PriceFetchError(f"No chart result for {instrument['vendor_symbol']}")
                meta = results[0]["meta"]
                price = meta.get("regularMarketPrice")
                previous = meta.get("chartPreviousClose")
                epoch = meta.get("regularMarketTime")
                if price is None or epoch is None:
                    raise PriceFetchError(f"Incomplete quote for {instrument['vendor_symbol']}")

                observed_at = datetime.fromtimestamp(epoch, tz=timezone.utc)
                observations.append(
                    {
                        "symbol": instrument["symbol"],
                        "name": instrument["name"],
                        "commodity_id": instrument["commodity_id"],
                        "price": round(float(price), 4),
                        "currency": meta.get("currency", "USD"),
                        "unit": instrument["unit"],
                        "change_pct": (
                            round((price - previous) / previous * 100, 2)
                            if previous
                            else None
                        ),
                        "observed_at": observed_at,
                        "source_id": self.source_id,
                        "source_ref": url,
                    }
                )
            except Exception as exc: # one bad symbol must not sink the whole run
                logger.warning("Price fetch failed for %s: %s", instrument["vendor_symbol"], exc)
        return observations


class ReferenceFileAdapter:
    """
    Offline fallback. Reads dated observations from a JSON file so an air-gapped demo
    still shows real, attributable numbers instead of an empty panel.
    """

    def __init__(self, path: str):
        self.path = path

    def fetch(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.path):
            raise PriceFetchError(f"Reference price file not found: {self.path}")
        with open(self.path) as handle:
            payload = json.load(handle)

        source_id = payload.get("source_id", "REFERENCE_FILE")
        source_ref = payload.get("source_ref")
        observations = []
        for row in payload.get("observations", []):
            observations.append(
                {
                    "symbol": row["symbol"],
                    "name": row["name"],
                    "commodity_id": row.get("commodity_id"),
                    "price": float(row["price"]),
                    "currency": row.get("currency", "USD"),
                    "unit": row["unit"],
                    "change_pct": row.get("change_pct"),
                    "observed_at": datetime.fromisoformat(row["observed_at"]).astimezone(timezone.utc),
                    "source_id": source_id,
                    "source_ref": row.get("source_ref", source_ref),
                }
            )
        return observations


class MarketPriceIngestionService:
    def __init__(self, db: Session, adapter):
        self.db = db
        self.adapter = adapter

    def run(self) -> Dict[str, int]:
        stats = {"fetched": 0, "inserted": 0, "duplicates": 0}
        observations = self.adapter.fetch()
        stats["fetched"] = len(observations)

        for obs in observations:
            observation_id = f"{obs['source_id']}:{obs['symbol']}:{obs['observed_at'].isoformat()}"
            existing = (
                self.db.query(MarketPrice)
                .filter(MarketPrice.source_observation_id == observation_id)
                .first()
            )
            if existing:
                stats["duplicates"] += 1
                continue

            self.db.add(
                MarketPrice(
                    symbol=obs["symbol"],
                    name=obs["name"],
                    commodity_id=obs.get("commodity_id"),
                    price=obs["price"],
                    currency=obs["currency"],
                    unit=obs["unit"],
                    change_pct=obs.get("change_pct"),
                    observed_at=obs["observed_at"].replace(tzinfo=None),
                    source_id=obs["source_id"],
                    source_ref=obs.get("source_ref"),
                    source_observation_id=observation_id,
                )
            )
            stats["inserted"] += 1

        self.db.commit()
        return stats
