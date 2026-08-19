from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.domain import Country, EnergyAsset, Route, TradeFlow, GeopoliticalEvent, RiskScore
from typing import Optional
from core.security import RequirePermissions, User

router = APIRouter(prefix="/api/v1/world", tags=["World/Digital Twin"])

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
        {"id": str(e.id), "type": e.type, "location": e.location, "severity": e.severity, "timestamp": e.timestamp.isoformat()}
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
    assets = db.query(EnergyAsset).all()
    # Simple sort mock for the "sort=risk" param to avoid errors
    return [{"id": a.id, "name": a.name, "type": a.type, "lat": a.latitude, "lng": a.longitude, "capacity": a.capacity} for a in assets]

@router.get("/routes")
def get_routes(db: Session = Depends(get_db), user: User = Depends(RequirePermissions("world:read"))):
    routes = db.query(Route).all()
    return [{"id": r.id, "name": r.name, "capacity": r.capacity} for r in routes]

@router.get("/supply-chain-status")
def get_supply_chain_status(user: User = Depends(RequirePermissions("world:read"))):
    return {"status": "data_unavailable", "message": "Aggregate supply chain health status is unavailable."}
