"""
Market and physical-balance derivations.

Everything here is computed from PostgreSQL rows (trade flows, assets, routes,
recorded events, ingested price observations). When the underlying rows are not
present the service returns status="data_unavailable" instead of inventing a number.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.domain import (
    Chokepoint,
    Country,
    EnergyAsset,
    GeopoliticalEvent,
    MarketPrice,
    Route,
    TradeFlow,
)

STORAGE_ASSET_TYPE = "STORAGE"
# A price older than this is still returned, but flagged so the UI can mark it stale.
PRICE_STALE_AFTER_HOURS = 48


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Postgres columns are naive here; treat stored timestamps as UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class MarketService:
    def __init__(self, db: Session):
        self.db = db

    # -----------------------------------------------------------------
    # RESERVE COVERAGE
    # -----------------------------------------------------------------
    def get_reserve_coverage(self, country_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Coverage days = strategic storage capacity (M bbl) / daily import demand (Mb/d).

        Import demand comes from the trade flows terminating in the country, so a country
        with storage but no modelled inbound flow reports coverage as unavailable rather
        than infinite.
        """
        countries = self.db.query(Country)
        if country_id:
            countries = countries.filter(Country.id == country_id)
        countries = countries.order_by(Country.id).all()

        if not countries:
            return {
                "status": "data_unavailable",
                "message": f"No country records found{' for ' + country_id if country_id else ''}.",
            }

        entries: List[Dict[str, Any]] = []
        for country in countries:
            storage = (
                self.db.query(func.coalesce(func.sum(EnergyAsset.capacity), 0.0))
                .filter(
                    EnergyAsset.country_id == country.id,
                    EnergyAsset.type == STORAGE_ASSET_TYPE,
                )
                .scalar()
                or 0.0
            )
            demand = (
                self.db.query(func.coalesce(func.sum(TradeFlow.volume), 0.0))
                .filter(TradeFlow.destination_country_id == country.id)
                .scalar()
                or 0.0
            )

            if storage <= 0 or demand <= 0:
                entries.append(
                    {
                        "country_id": country.id,
                        "country": country.name,
                        "status": "data_unavailable",
                        "reason": (
                            "No strategic storage assets recorded"
                            if storage <= 0
                            else "No inbound trade flows recorded"
                        ),
                        "storage_capacity_mbbl": round(storage, 2),
                        "daily_import_demand_mbd": round(demand, 3),
                    }
                )
                continue

            coverage_days = storage / demand
            target = country.reserve_target_days
            entries.append(
                {
                    "country_id": country.id,
                    "country": country.name,
                    "status": "ok",
                    "storage_capacity_mbbl": round(storage, 2),
                    "daily_import_demand_mbd": round(demand, 3),
                    "coverage_days": round(coverage_days, 1),
                    "target_days": target,
                    "gap_days": round(coverage_days - target, 1) if target else None,
                    "assessment": (
                        None
                        if target is None
                        else ("Below Target" if coverage_days < target else "At Target")
                    ),
                }
            )

        payload: Dict[str, Any] = {
            "status": "ok",
            "countries": entries,
            "methodology": "coverage_days = sum(STORAGE asset capacity, M bbl) / sum(inbound trade flow volume, Mb/d)",
            "assumptions": [
                "Storage capacity is fully available for drawdown",
                "Inbound trade flow volume is a proxy for daily import demand",
                "Targets are the country's published strategic reserve obligation in days",
            ],
            "provenance": ["PostgreSQL energy_assets", "PostgreSQL trade_flows", "PostgreSQL countries"],
        }

        if country_id:
            single = entries[0]
            payload.update(single)
            payload["status"] = single["status"]
        return payload

    # -----------------------------------------------------------------
    # PRICES
    # -----------------------------------------------------------------
    def get_prices(self) -> Dict[str, Any]:
        """Latest observation per symbol, each tagged with its own source and age."""
        subquery = (
            self.db.query(
                MarketPrice.symbol.label("symbol"),
                func.max(MarketPrice.observed_at).label("latest"),
            )
            .group_by(MarketPrice.symbol)
            .subquery()
        )
        rows = (
            self.db.query(MarketPrice)
            .join(
                subquery,
                (MarketPrice.symbol == subquery.c.symbol)
                & (MarketPrice.observed_at == subquery.c.latest),
            )
            .order_by(MarketPrice.symbol)
            .all()
        )

        if not rows:
            return {
                "status": "data_unavailable",
                "message": "No price observations ingested. Run scripts/ingest_market_prices.py.",
            }

        now = _utcnow()
        prices = []
        for row in rows:
            observed = _as_utc(row.observed_at)
            age_hours = (now - observed).total_seconds() / 3600 if observed else None
            prices.append(
                {
                    "symbol": row.symbol,
                    "name": row.name,
                    "price": row.price,
                    "currency": row.currency,
                    "unit": row.unit,
                    "change_pct": row.change_pct,
                    "observed_at": observed.isoformat() if observed else None,
                    "age_hours": round(age_hours, 1) if age_hours is not None else None,
                    "stale": bool(age_hours is not None and age_hours > PRICE_STALE_AFTER_HOURS),
                    "source_id": row.source_id,
                    "source_ref": row.source_ref,
                }
            )

        return {
            "status": "ok",
            "prices": prices,
            "as_of": max((p["observed_at"] for p in prices if p["observed_at"]), default=None),
            "provenance": sorted({p["source_id"] for p in prices if p["source_id"]}),
        }

    def get_benchmark_price(self, symbol: str = "BRENT") -> Optional[Dict[str, Any]]:
        """
        Latest observation for one benchmark, for downstream valuation. Returns None when
        no observation exists so callers report the missing input instead of assuming one.
        """
        row = (
            self.db.query(MarketPrice)
            .filter(MarketPrice.symbol == symbol)
            .order_by(MarketPrice.observed_at.desc())
            .first()
        )
        if not row:
            return None
        observed = _as_utc(row.observed_at)
        return {
            "symbol": row.symbol,
            "name": row.name,
            "price": row.price,
            "currency": row.currency,
            "unit": row.unit,
            "observed_at": observed.isoformat() if observed else None,
            "source_id": row.source_id,
            "source_ref": row.source_ref,
        }

    # -----------------------------------------------------------------
    # SUPPLY BALANCE TIMESERIES
    # -----------------------------------------------------------------
    def get_balance_timeseries(self, days: int = 15) -> Dict[str, Any]:
        """
        Daily physical balance over a trailing window.

        Contracted demand is the sum of modelled trade flow volumes. Delivered supply is
        that same volume reduced by the share of it that moves through a chokepoint with
        a recorded disruptive event on that day, scaled by the event's severity and
        confidence. Days with no recorded event carry no reduction; that is an explicit
        assumption, not an assertion that nothing happened.
        """
        flows = self.db.query(TradeFlow).all()
        if not flows:
            return {
                "status": "data_unavailable",
                "message": "No trade flows recorded; physical balance cannot be derived.",
            }

        routes = {r.id: r for r in self.db.query(Route).all()}
        contracted = sum(f.volume or 0.0 for f in flows)
        if contracted <= 0:
            return {"status": "data_unavailable", "message": "Trade flow volumes are zero."}

        # Volume at risk behind each chokepoint.
        volume_by_chokepoint: Dict[str, float] = {}
        for flow in flows:
            route = routes.get(flow.route_id)
            if route and route.chokepoint_id:
                volume_by_chokepoint[route.chokepoint_id] = (
                    volume_by_chokepoint.get(route.chokepoint_id, 0.0) + (flow.volume or 0.0)
                )

        window_start = _utcnow() - timedelta(days=days - 1)
        events = (
            self.db.query(GeopoliticalEvent)
            .filter(GeopoliticalEvent.timestamp >= window_start.replace(tzinfo=None))
            .all()
        )

        # Bucket the worst disruption factor per chokepoint per day.
        by_day: Dict[str, Dict[str, float]] = {}
        for event in events:
            entity = event.affected_entity_id
            if not entity or entity not in volume_by_chokepoint:
                continue
            observed = _as_utc(event.timestamp)
            if observed is None:
                continue
            key = observed.date().isoformat()
            factor = (event.severity or 0.0) * (event.confidence or 1.0)
            day_bucket = by_day.setdefault(key, {})
            day_bucket[entity] = max(day_bucket.get(entity, 0.0), factor)

        series = []
        today = _utcnow().date()
        for offset in range(days - 1, -1, -1):
            day = today - timedelta(days=offset)
            key = day.isoformat()
            disrupted = 0.0
            drivers = []
            for chokepoint_id, factor in by_day.get(key, {}).items():
                at_risk = volume_by_chokepoint.get(chokepoint_id, 0.0)
                disrupted += at_risk * factor
                drivers.append({"chokepoint_id": chokepoint_id, "disruption_factor": round(factor, 3)})
            delivered = max(contracted - disrupted, 0.0)
            series.append(
                {
                    "date": key,
                    "demand_mbd": round(contracted, 3),
                    "supply_mbd": round(delivered, 3),
                    "balance_mbd": round(delivered - contracted, 3),
                    "drivers": drivers,
                }
            )

        return {
            "status": "ok",
            "unit": "million barrels per day",
            "window_days": days,
            "contracted_demand_mbd": round(contracted, 3),
            "series": series,
            "methodology": (
                "supply = contracted flow volume - sum(volume behind each chokepoint x "
                "max(event severity x confidence) recorded for that chokepoint that day)"
            ),
            "assumptions": [
                "Contracted trade flow volume is treated as steady daily demand",
                "Days without a recorded event are modelled as undisrupted",
                "Only flows on routes mapped to a chokepoint can be disrupted",
            ],
            "provenance": [
                "PostgreSQL trade_flows",
                "PostgreSQL routes",
                "PostgreSQL geopolitical_events",
            ],
        }
