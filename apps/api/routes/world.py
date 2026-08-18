from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.database import get_db
from models.domain import Country, EnergyAsset, Route, TradeFlow

router = APIRouter(prefix="/api/v1/world", tags=["World/Digital Twin"])

@router.get("/overview")
def get_world_overview(db: Session = Depends(get_db)):
    countries = db.query(Country).count()
    assets = db.query(EnergyAsset).count()
    routes = db.query(Route).count()
    
    return {
        "active_nodes": countries + assets,
        "active_edges": routes,
        "systemic_risk": 42.5, # Placeholder for aggregated risk
        "supply_stress": 12.0
    }

@router.get("/assets")
def get_assets(db: Session = Depends(get_db)):
    assets = db.query(EnergyAsset).all()
    return [{"id": a.id, "name": a.name, "type": a.type, "lat": a.latitude, "lng": a.longitude, "capacity": a.capacity} for a in assets]

@router.get("/routes")
def get_routes(db: Session = Depends(get_db)):
    routes = db.query(Route).all()
    return [{"id": r.id, "name": r.name, "capacity": r.capacity} for r in routes]
