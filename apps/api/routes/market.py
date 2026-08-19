from fastapi import APIRouter, Depends, HTTPException
from core.security import RequirePermissions, User
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from models.domain import Scenario, Job

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
def get_reserve_coverage(user: User = Depends(RequirePermissions("world:read"))):
    return {"status": "data_unavailable", "message": "Real-time reserve coverage metrics are currently out of scope for the physical topology."}

@router.get("/prices")
def get_prices(user: User = Depends(RequirePermissions("world:read"))):
    return {"status": "data_unavailable", "message": "Real-time financial market integration is out of scope."}

@router.get("/balance-timeseries")
def get_balance_timeseries(user: User = Depends(RequirePermissions("world:read"))):
    return {"status": "data_unavailable", "message": "Live supply balance timeseries is out of scope."}
