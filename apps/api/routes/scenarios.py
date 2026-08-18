from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, Any
import uuid

from core.database import get_db
from models.domain import Scenario, Job, JobStatus
from simulation.monte_carlo.runner import run_monte_carlo
from models.domain import TradeFlow

router = APIRouter(prefix="/api/v1/scenarios", tags=["Scenarios"])

class ScenarioCreateRequest(BaseModel):
    name: str
    chokepoint_id: str
    severity: float
    duration_days: int

def execute_scenario_simulation(job_id: str, chokepoint_id: str, severity: float):
    # In a real app this runs in Celery. For MVP, we'll execute it synchronously in a background task
    # so we don't block the request, but avoid setting up full Celery workers just for local dev if they fail.
    db = next(get_db())
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        return
        
    try:
        job.status = JobStatus.RUNNING
        db.commit()
        
        # 1. Get baseline flows
        flows = db.query(TradeFlow).all()
        baseline_flows = [
            {
                "supplier": f.supplier_id,
                "chokepoint": "CHK_HORMUZ" if "HORMUZ" in f.route_id else "NONE",
                "destination": f.destination_country_id,
                "volume": f.volume
            } for f in flows
        ]
        
        # 2. Run Monte Carlo / Cascade
        mc_results = run_monte_carlo(baseline_flows, chokepoint_id, severity, iterations=50)
        
        # 3. Save result
        job.result = {
            "monte_carlo": mc_results,
            "affected_routes": ["RT_HORMUZ_ASIA"],
            "cascade_impact": "Severe downstream supply shock detected."
        }
        job.status = JobStatus.COMPLETED
        db.commit()
    except Exception as e:
        job.status = JobStatus.FAILED
        job.error = str(e)
        db.commit()
    finally:
        db.close()

@router.post("")
def create_scenario(req: ScenarioCreateRequest, db: Session = Depends(get_db)):
    scenario = Scenario(
        name=req.name,
        parameters={"chokepoint": req.chokepoint_id, "severity": req.severity, "duration": req.duration_days}
    )
    db.add(scenario)
    db.commit()
    return {"id": scenario.id, "message": "Scenario created"}

@router.post("/{id}/run")
def run_scenario(id: str, bg_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
        
    job = Job(type="SCENARIO_SIMULATION")
    db.add(job)
    scenario.job_id = job.id
    db.commit()
    
    # Run async (Celery substitute for immediate hackathon execution)
    bg_tasks.add_task(
        execute_scenario_simulation, 
        job.id, 
        scenario.parameters["chokepoint"], 
        scenario.parameters["severity"]
    )
    
    return {"job_id": job.id, "status": "QUEUED"}

@router.get("/{id}/results")
def get_scenario_results(id: str, db: Session = Depends(get_db)):
    scenario = db.query(Scenario).filter(Scenario.id == id).first()
    if not scenario or not scenario.job_id:
        raise HTTPException(status_code=404)
        
    job = db.query(Job).filter(Job.id == scenario.job_id).first()
    return {
        "scenario_id": scenario.id,
        "job_status": job.status.value,
        "results": job.result
    }
