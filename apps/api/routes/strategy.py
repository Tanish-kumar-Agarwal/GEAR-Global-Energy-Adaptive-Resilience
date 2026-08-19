from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel
from core.database import get_db
from models.domain import Job
from services.strategy_service import StrategyService
from workers.tasks import run_strategy_pipeline
from core.security import RequirePermissions, User

router = APIRouter(prefix="/api/v1/strategy", tags=["Strategy"])

class StrategyCreateRequest(BaseModel):
    name: str
    baseline_scenario_id: str
    levers: List[Dict[str, Any]]

@router.post("/scenarios")
def create_strategy_scenario(req: StrategyCreateRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("scenario:create"))):
    svc = StrategyService(db)
    strategy = svc.create_strategy(req.name, req.baseline_scenario_id, req.levers)
    
    try:
        # Enqueue task
        run_strategy_pipeline.delay(str(strategy.id))
    except Exception as e:
        db.delete(strategy)
        db.query(Job).filter(Job.id == strategy.job_id).delete()
        db.commit()
        raise HTTPException(
            status_code=503,
            detail={
                "status": "failed",
                "error_code": "QUEUE_UNAVAILABLE",
                "component": "redis",
                "retryable": True
            }
        )
    
    return {"strategy_id": str(strategy.id), "status": "QUEUED"}

@router.get("/scenarios/{strategy_id}")
def get_strategy_scenario(strategy_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("scenario:read"))):
    svc = StrategyService(db)
    result = svc.get_strategy(strategy_id)
    if not result:
        raise HTTPException(status_code=404, detail="Strategy Scenario not found")
    return result

@router.get("/options")
def get_strategy_options(db: Session = Depends(get_db), user: User = Depends(RequirePermissions("scenario:read"))):
    # Returns available strategic options from Digital Twin
    return {
        "status": "AVAILABLE",
        "supplier_diversification": True,
        "route_diversification": True,
        "reserve_strategy": True,
        "chokepoint_diversification": True,
        "financial_optimization": "DATA_UNAVAILABLE" # As per prompt
    }
