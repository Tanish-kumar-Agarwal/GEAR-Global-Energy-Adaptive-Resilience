"""
Route-level supply chain health derived from PostgreSQL topology plus recorded risk.

A route inherits the risk of the chokepoint it must transit, which is what makes a
single chokepoint event visible as pressure on every downstream flow.
"""

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.domain import Chokepoint, Route, RiskScore, TradeFlow

DISRUPTED_AT = 80.0
STRESSED_AT = 60.0
HIGH_UTILISATION = 0.9


class SupplyChainService:
    def __init__(self, db: Session):
        self.db = db

    def _latest_risk(self) -> Dict[str, RiskScore]:
        latest: Dict[str, RiskScore] = {}
        for risk in self.db.query(RiskScore).order_by(RiskScore.timestamp.asc()).all():
            if risk.entity_id:
                latest[risk.entity_id] = risk
        return latest

    @staticmethod
    def _status_for(score: Optional[float], utilisation: float) -> str:
        if score is not None and score >= DISRUPTED_AT:
            return "DISRUPTED"
        if (score is not None and score >= STRESSED_AT) or utilisation > HIGH_UTILISATION:
            return "STRESSED"
        return "NOMINAL"

    def get_route_status(self) -> List[Dict[str, Any]]:
        routes = self.db.query(Route).order_by(Route.id).all()
        if not routes:
            return []

        chokepoints = {c.id: c for c in self.db.query(Chokepoint).all()}
        latest_risk = self._latest_risk()

        committed: Dict[str, float] = {}
        for flow in self.db.query(TradeFlow).all():
            if flow.route_id:
                committed[flow.route_id] = committed.get(flow.route_id, 0.0) + (flow.volume or 0.0)

        rows = []
        for route in routes:
            volume = committed.get(route.id, 0.0)
            capacity = route.capacity or 0.0
            utilisation = volume / capacity if capacity > 0 else 0.0

            # A route's own risk record wins; otherwise it inherits its chokepoint's.
            risk = latest_risk.get(route.id) or (
                latest_risk.get(route.chokepoint_id) if route.chokepoint_id else None
            )
            score = round(risk.score, 1) if risk else None
            chokepoint = chokepoints.get(route.chokepoint_id) if route.chokepoint_id else None

            rows.append(
                {
                    "id": route.id,
                    "name": route.name,
                    "capacity_mbd": round(capacity, 3),
                    "committed_mbd": round(volume, 3),
                    "utilisation": round(utilisation, 3),
                    "transit_time_days": route.transit_time_days,
                    "chokepoint_id": route.chokepoint_id,
                    # Full ordered linkage from route geometry; falls back to the
                    # single declared FK for rows the backfill has not touched.
                    "chokepoint_ids": route.chokepoint_ids
                    or ([route.chokepoint_id] if route.chokepoint_id else []),
                    "chokepoint": chokepoint.name if chokepoint else None,
                    "risk_score": score,
                    "risk_source": (
                        None
                        if risk is None
                        else ("route" if risk.entity_id == route.id else "chokepoint")
                    ),
                    "status": self._status_for(score, utilisation),
                    "path": route.path,
                }
            )
        return rows

    def get_supply_chain_status(self) -> Dict[str, Any]:
        routes = self.get_route_status()
        if not routes:
            return {
                "status": "data_unavailable",
                "message": "No routes recorded; supply chain health cannot be derived.",
            }

        total_capacity = sum(r["capacity_mbd"] for r in routes)
        total_committed = sum(r["committed_mbd"] for r in routes)
        at_risk = sum(r["committed_mbd"] for r in routes if r["status"] != "NOMINAL")
        disrupted = [r for r in routes if r["status"] == "DISRUPTED"]
        stressed = [r for r in routes if r["status"] == "STRESSED"]

        if disrupted:
            overall = "DISRUPTED"
        elif stressed:
            overall = "STRESSED"
        else:
            overall = "NOMINAL"

        return {
            "status": "ok",
            "overall_status": overall,
            "unit": "million barrels per day",
            "total_capacity_mbd": round(total_capacity, 3),
            "total_committed_mbd": round(total_committed, 3),
            "volume_at_risk_mbd": round(at_risk, 3),
            "share_at_risk": round(at_risk / total_committed, 3) if total_committed else 0.0,
            "routes_disrupted": len(disrupted),
            "routes_stressed": len(stressed),
            "routes_nominal": len(routes) - len(disrupted) - len(stressed),
            "routes": routes,
            "methodology": (
                f"A route is DISRUPTED at risk >= {DISRUPTED_AT}, STRESSED at risk >= {STRESSED_AT} "
                f"or utilisation > {HIGH_UTILISATION}. Routes with no risk record of their own "
                "inherit the latest risk score of the chokepoint they transit."
            ),
            "provenance": [
                "PostgreSQL routes",
                "PostgreSQL trade_flows",
                "PostgreSQL risk_scores",
                "PostgreSQL chokepoints",
            ],
        }
