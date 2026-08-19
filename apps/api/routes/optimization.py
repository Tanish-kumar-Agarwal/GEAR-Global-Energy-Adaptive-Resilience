from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from core.database import get_db
from models.domain import Job, JobStatus
from workers.tasks import execute_recovery_optimization
from core.security import RequirePermissions, User

router = APIRouter(prefix="/api/v1/optimization", tags=["Optimization"])

class OptimizationRequest(BaseModel):
    scenario_id: str

@router.post("/procurement", status_code=202)
def run_procurement_optimization(req: OptimizationRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("optimization:execute"))):
    # Verify the scenario job exists
    scenario_id_uuid = uuid.UUID(req.scenario_id)
    scenario_job = db.query(Job).filter(Job.id == scenario_id_uuid).first()
    if not scenario_job:
        raise HTTPException(status_code=404, detail="Scenario job not found")
        
    # Create the optimization job
    opt_job = Job(type="RECOVERY_OPTIMIZATION")
    db.add(opt_job)
    db.commit()
    
    try:
        # Trigger Celery task
        execute_recovery_optimization.delay(str(opt_job.id), str(scenario_job.id))
    except Exception as e:
        db.delete(opt_job)
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
    
    return {"job_id": str(opt_job.id), "status": "QUEUED"}

@router.get("/{job_id}")
def get_optimization_result(job_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("optimization:read"))):
    job_uuid = uuid.UUID(job_id)
    job = db.query(Job).filter(Job.id == job_uuid).first()
    if not job:
        raise HTTPException(status_code=404, detail="Optimization job not found")
        
    return {
        "job_id": str(job.id),
        "status": job.status.value,
        "result": job.result
    }
