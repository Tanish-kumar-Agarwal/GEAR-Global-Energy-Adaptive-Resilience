from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any
import uuid

from core.database import get_db
from models.domain import Scenario, Job, JobStatus
from simulation.monte_carlo.runner import run_monte_carlo
from models.domain import TradeFlow
from core.security import RequirePermissions, User

router = APIRouter(prefix="/api/v1/scenarios", tags=["Scenarios"])

class ScenarioCreateRequest(BaseModel):
    name: str
    target_id: str
    severity: float
    duration_days: int

from workers.tasks import execute_scenario_simulation

@router.post("")
def create_scenario(req: ScenarioCreateRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("scenario:create"))):
    scenario = Scenario(
        name=req.name,
        parameters={"target_id": req.target_id, "severity": req.severity, "duration": req.duration_days}
    )
    db.add(scenario)
    db.commit()
    return {"id": scenario.id, "message": "Scenario created"}

@router.post("/{id}/run", status_code=202)
def run_scenario(id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("scenario:execute"))):
    scenario_id = uuid.UUID(id)
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
        
    job = Job(type="SCENARIO_SIMULATION")
    db.add(job)
    scenario.job_id = job.id
    db.commit()
    
    try:
        # Run in Celery
        execute_scenario_simulation.delay(
            str(job.id), 
            scenario.parameters["target_id"], 
            scenario.parameters["severity"],
            scenario.parameters.get("duration", 30)
        )
    except Exception as e:
        scenario.job_id = None
        db.delete(job)
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
    
    return {"job_id": job.id, "status": "QUEUED"}

@router.get("/{id}/results")
def get_scenario_results(id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("scenario:read"))):
    scenario_id = uuid.UUID(id)
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario or not scenario.job_id:
        raise HTTPException(status_code=404)
        
    job = db.query(Job).filter(Job.id == scenario.job_id).first()
    return {
        "scenario_id": scenario.id,
        "job_status": job.status.value,
        "results": job.result
    }
