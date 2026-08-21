from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.domain import Country, EnergyAsset, Route, TradeFlow, GeopoliticalEvent, RiskScore, Chokepoint
from typing import Optional
from core.security import RequirePermissions, User
from services.supply_chain_service import SupplyChainService

router = APIRouter(prefix="/api/v1/world", tags=["World/Digital Twin"])


def _latest_risk_by_entity(db: Session):
    latest = {}
    for risk in db.query(RiskScore).order_by(RiskScore.timestamp.asc()).all():
        if risk.entity_id:
            latest[risk.entity_id] = risk
    return latest


@router.get("/overview")
def get_world_overview(db: Session = Depends(get_db), user: User = Depends(RequirePermissions("world:read"))):
    countries = db.query(Country).count()
    assets = db.query(EnergyAsset).count()
    routes = db.query(Route).count()

    risks = db.query(RiskScore).all()
    events = db.query(GeopoliticalEvent).order_by(GeopoliticalEvent.timestamp.desc()).limit(10).all()

    if not risks or not events:
        return {
            "status": "data_unavailable",
            "message": "Insufficient risk or event data for world overview."
        }

    avg_risk = sum(r.score for r in risks) / len(risks)
    supply_stress = sum(e.severity * 100 for e in events) / len(events)

    recent_events = [
        {
            "id": str(e.id),
            "type": e.type,
            "title": e.title,
            "location": e.location,
            "severity": e.severity,
            "confidence": e.confidence,
            "source_id": e.source_id,
            "timestamp": e.timestamp.isoformat(),
        }
        for e in events[:5]
    ]

    return {
        "status": "ok",
        "active_nodes": countries + assets,
        "active_edges": routes,
        "systemic_risk": round(avg_risk, 1),
        "supply_stress": round(supply_stress, 1),
        "recent_events": recent_events
    }

@router.get("/assets")
def get_assets(sort: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("world:read"))):
    """Assets with their latest risk score. sort=risk puts the most exposed first."""
    assets = db.query(EnergyAsset).all()
    latest_risk = _latest_risk_by_entity(db)

    # An asset with no risk record of its own inherits its country's score, which is how
    # a country-level event surfaces on the watchlist.
    rows = []
    for a in assets:
        risk = latest_risk.get(a.id) or latest_risk.get(a.country_id)
        rows.append({
            "id": a.id,
            "name": a.name,
            "type": a.type,
            "country_id": a.country_id,
            "lat": a.latitude,
            "lng": a.longitude,
            "capacity": a.capacity,
            "risk_score": round(risk.score, 1) if risk else None,
            "risk_level": risk.level.value if risk else None,
            "risk_source": None if risk is None else ("asset" if risk.entity_id == a.id else "country"),
        })

    if sort == "risk":
        rows.sort(key=lambda r: (r["risk_score"] is not None, r["risk_score"] or 0), reverse=True)
    return rows

@router.get("/chokepoints")
def get_chokepoints(db: Session = Depends(get_db), user: User = Depends(RequirePermissions("world:read"))):
    latest_risk = _latest_risk_by_entity(db)
    chokepoints = db.query(Chokepoint).order_by(Chokepoint.id).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "lat": c.latitude,
            "lng": c.longitude,
            "region": c.region,
            "daily_transit_volume": c.daily_transit_volume,
            "risk_factor": c.risk_factor,
            "risk_score": round(latest_risk[c.id].score, 1) if c.id in latest_risk else None,
            "risk_level": latest_risk[c.id].level.value if c.id in latest_risk else None,
        }
        for c in chokepoints
    ]

@router.get("/routes")
def get_routes(db: Session = Depends(get_db), user: User = Depends(RequirePermissions("world:read"))):
    """Routes with geometry, committed volume and inherited chokepoint risk, for map rendering."""
    return SupplyChainService(db).get_route_status()

@router.get("/supply-chain-status")
def get_supply_chain_status(db: Session = Depends(get_db), user: User = Depends(RequirePermissions("world:read"))):
    return SupplyChainService(db).get_supply_chain_status()
