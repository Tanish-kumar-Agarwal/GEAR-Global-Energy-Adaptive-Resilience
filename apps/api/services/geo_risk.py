"""Shared risk scoring and status mapping for map entities (routes, chokepoints).

Risk scores are on a 0..100 scale, matching RiskScore.score. Status thresholds
(used by /world/routes, /world/chokepoints and scenario impact overlays):

    score < 40           -> "stable"
    40 <= score < 70     -> "at_risk"
    score >= 70          -> "disrupted"

40 marks the bottom of the MEDIUM band already used by RiskScore levels in the
demo dataset (e.g. 40.0 -> MEDIUM); 70 marks where HIGH/CRITICAL scores start.
"""

from typing import Dict, Iterable, List, Optional

from models.domain import Chokepoint, RiskScore, Route

STABLE_BELOW = 40.0
DISRUPTED_FROM = 70.0

STATUS_STABLE = "stable"
STATUS_AT_RISK = "at_risk"
STATUS_DISRUPTED = "disrupted"


def status_for_score(score: float) -> str:
    if score >= DISRUPTED_FROM:
        return STATUS_DISRUPTED
    if score >= STABLE_BELOW:
        return STATUS_AT_RISK
    return STATUS_STABLE


def latest_risk_scores(db, entity_ids: Iterable[str]) -> Dict[str, float]:
    """Latest RiskScore.score per entity id, one query."""
    ids = [i for i in entity_ids if i]
    if not ids:
        return {}
    rows = (
        db.query(RiskScore)
        .filter(RiskScore.entity_id.in_(ids))
        .order_by(RiskScore.entity_id, RiskScore.timestamp.desc())
        .all()
    )
    latest: Dict[str, float] = {}
    for row in rows:
        if row.entity_id not in latest:
            latest[row.entity_id] = row.score
    return latest


def chokepoint_risk_score(cp: Chokepoint, latest: Dict[str, float]) -> float:
    """Latest scored risk if present, else the static risk_factor scaled to 0..100."""
    if cp.id in latest:
        return round(latest[cp.id], 1)
    return round((cp.risk_factor or 0.0) * 100.0, 1)


def route_risk_score(route: Route, chokepoints_by_id: Dict[str, Chokepoint], latest: Dict[str, float]) -> float:
    """A route's own latest RiskScore wins; otherwise it inherits the worst
    risk among the chokepoints it passes through (a route is only as safe as
    its riskiest chokepoint)."""
    if route.id in latest:
        return round(latest[route.id], 1)
    cp_scores: List[float] = [
        chokepoint_risk_score(chokepoints_by_id[cp_id], latest)
        for cp_id in (route.chokepoint_ids or [])
        if cp_id in chokepoints_by_id
    ]
    return round(max(cp_scores), 1) if cp_scores else 0.0
