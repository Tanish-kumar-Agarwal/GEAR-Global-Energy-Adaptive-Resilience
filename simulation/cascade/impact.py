"""Per-entity geographic impact of a scenario, keyed by route id and chokepoint id.

This is what lets the map react to scenario parameters: the worker attaches the
output as an overlay block on job.result and the frontend repaints routes and
chokepoints from it.

Escalation model (deterministic, documented so thresholds are auditable):

    duration_factor = min(duration_days, 90) / 90      # saturates at 90 days
    direct_boost    = severity * 70 + duration_factor * 15

    disruption target:                    base + 1.0 * direct_boost
    routes touching the target (1 hop):   base + 0.8 * direct_boost
    other chokepoints on impacted routes: base + 0.3 * direct_boost

All scores are capped at 100. "base" is the entity's current risk from
services.geo_risk (latest RiskScore, else static risk_factor scaled to 0..100),
so scenario impact stacks on top of live baseline risk. Both severity and
duration therefore visibly change every score in the overlay.
"""

from typing import Dict, List, Optional

from models.domain import Chokepoint, Route
from services.geo_risk import (
    chokepoint_risk_score,
    latest_risk_scores,
    route_risk_score,
    status_for_score,
)

TARGET_WEIGHT = 1.0
ROUTE_WEIGHT = 0.8
NEIGHBOR_CHOKEPOINT_WEIGHT = 0.3


def _escalate(base: float, boost: float, weight: float) -> float:
    return round(min(100.0, base + weight * boost), 1)


def compute_geo_impact(
    db,
    target_id: str,
    severity: float,
    duration_days: int,
    affected_route_ids: Optional[List[str]] = None,
    include_base: bool = False,
) -> Dict[str, list]:
    """Returns {"impacted_routes": [...], "impacted_chokepoints": [...]}.

    affected_route_ids lets the caller pass routes the graph cascade already
    identified; routes linked to the target through chokepoint_ids are added
    from PostgreSQL so the overlay still works when the graph is unavailable.
    include_base adds a "base_score" (pre-scenario baseline) to every entry so
    callers such as the preview endpoint can flag saturated entities; the
    default output shape is unchanged.
    """
    routes = db.query(Route).all()
    chokepoints = db.query(Chokepoint).all()
    chokepoints_by_id = {cp.id: cp for cp in chokepoints}

    latest = latest_risk_scores(
        db, [r.id for r in routes] + [cp.id for cp in chokepoints] + [target_id]
    )

    duration_factor = min(max(duration_days, 0), 90) / 90.0
    boost = severity * 70.0 + duration_factor * 15.0

    impacted_route_ids = set(affected_route_ids or [])
    for route in routes:
        if target_id in (route.chokepoint_ids or []) or route.id == target_id:
            impacted_route_ids.add(route.id)

    impacted_routes = []
    impacted_cp_ids = set()
    for route in routes:
        if route.id not in impacted_route_ids:
            continue
        base = route_risk_score(route, chokepoints_by_id, latest)
        weight = TARGET_WEIGHT if route.id == target_id else ROUTE_WEIGHT
        score = _escalate(base, boost, weight)
        entry = {"route_id": route.id, "risk_score": score, "status": status_for_score(score)}
        if include_base:
            entry["base_score"] = base
        impacted_routes.append(entry)
        impacted_cp_ids.update(route.chokepoint_ids or [])

    if target_id in chokepoints_by_id:
        impacted_cp_ids.add(target_id)

    impacted_chokepoints = []
    for cp_id in sorted(impacted_cp_ids):
        cp = chokepoints_by_id.get(cp_id)
        if not cp:
            continue
        base = chokepoint_risk_score(cp, latest)
        weight = TARGET_WEIGHT if cp.id == target_id else NEIGHBOR_CHOKEPOINT_WEIGHT
        score = _escalate(base, boost, weight)
        entry = {"chokepoint_id": cp.id, "risk_score": score, "status": status_for_score(score)}
        if include_base:
            entry["base_score"] = base
        impacted_chokepoints.append(entry)

    return {"impacted_routes": impacted_routes, "impacted_chokepoints": impacted_chokepoints}
