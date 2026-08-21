from fastapi import APIRouter, Depends, HTTPException, Query
from core.security import RequirePermissions, User
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from models.domain import Scenario, Job
from services.market_data_service import get_live_prices
from services.market_service import MarketService

router = APIRouter(prefix="/api/v1/market", tags=["Market"])

@router.get("/economic-impact")
def get_economic_impact(scenario_id: Optional[str] = None, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("world:read"))):
    if not scenario_id:
        return {"status": "data_unavailable", "message": "scenario_id is required"}
        
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario or not scenario.job_id:
        return {"status": "data_unavailable", "message": "Scenario not found or job not started"}
        
    job = db.query(Job).filter(Job.id == scenario.job_id).first()
    if not job or job.status.value != "COMPLETED":
        return {"status": "data_unavailable", "message": f"Job is not completed. Current status: {job.status.value if job else 'Unknown'}"}
        
    if not job.result or "economic_impact" not in job.result:
        return {"status": "data_unavailable", "message": "Economic impact data not found in job results"}
        
    return job.result["economic_impact"]

@router.get("/reserve-coverage")
def get_reserve_coverage(
    country_id: Optional[str] = Query(None, description="ISO-3 country code, e.g. IND"),
    db: Session = Depends(get_db),
    user: User = Depends(RequirePermissions("world:read")),
):
    return MarketService(db).get_reserve_coverage(country_id)

@router.get("/prices")
def get_prices(db: Session = Depends(get_db), user: User = Depends(RequirePermissions("world:read"))):
    # Ingested observations first: they carry per-row source and staleness.
    result = MarketService(db).get_prices()
    if result.get("status") == "ok":
        return result
    # Nothing ingested yet: fetch spot prices live from the EIA API instead
    # (needs EIA_API_KEY; see .env.example).
    live = get_live_prices()
    if live is not None:
        return live
    return result

@router.get("/balance-timeseries")
def get_balance_timeseries(
    days: int = Query(15, ge=2, le=120, description="Trailing window length in days"),
    db: Session = Depends(get_db),
    user: User = Depends(RequirePermissions("world:read")),
):
    return MarketService(db).get_balance_timeseries(days)
