from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, model_validator
from typing import Optional
import uuid

from core.database import get_db
from models.domain import Job, JobStatus, Scenario
from workers.tasks import execute_recovery_optimization
from core.security import RequirePermissions, User

router = APIRouter(prefix="/api/v1/optimization", tags=["Optimization"])


def _parse_uuid(value: str, what: str) -> uuid.UUID:
    """422 with a clear message instead of an unhandled ValueError turning
    into a 500 (the swallow-and-obscure pattern that hid earlier bugs)."""
    try:
        return uuid.UUID(value)
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(status_code=422, detail=f"'{value}' is not a valid {what} (expected a UUID)")


class OptimizationRequest(BaseModel):
    # job_id is the scenario RUN job. scenario_id (legacy name) is kept for
    # backward compatibility and may hold either a scenario id or a job id;
    # the handler resolves it. New callers should send job_id.
    job_id: Optional[str] = None
    scenario_id: Optional[str] = None

    @model_validator(mode="after")
    def _one_id_required(self):
        if not self.job_id and not self.scenario_id:
            raise ValueError("Provide job_id (scenario run job) or scenario_id.")
        return self


def _resolve_scenario_job(req: OptimizationRequest, db: Session) -> Job:
    if req.job_id:
        job = db.query(Job).filter(Job.id == _parse_uuid(req.job_id, "job_id")).first()
        if not job:
            raise HTTPException(status_code=404, detail="Scenario job not found")
        return job

    # Legacy field: historically callers had to pass the run JOB id here even
    # though the field says scenario. Accept both meanings: scenario id first
    # (resolving to its job), then job id.
    legacy = _parse_uuid(req.scenario_id, "scenario_id")
    scenario = db.query(Scenario).filter(Scenario.id == legacy).first()
    if scenario:
        if not scenario.job_id:
            raise HTTPException(status_code=409, detail="Scenario exists but has never been run; run it first.")
        job = db.query(Job).filter(Job.id == scenario.job_id).first()
        if job:
            return job
    job = db.query(Job).filter(Job.id == legacy).first()
    if not job:
        raise HTTPException(status_code=404, detail="No scenario or scenario job with that id")
    return job


@router.post("/procurement", status_code=202)
def run_procurement_optimization(req: OptimizationRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("optimization:execute"))):
    scenario_job = _resolve_scenario_job(req, db)

    # Create the optimization job
    opt_job = Job(type="RECOVERY_OPTIMIZATION")
    db.add(opt_job)
    db.commit()

    try:
        # Trigger Celery task
        execute_recovery_optimization.delay(str(opt_job.id), str(scenario_job.id))
    except Exception:
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


# Declared before /{job_id} so the literal path wins the match.
@router.get("/runs")
def list_optimization_runs(limit: int = 20, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("optimization:read"))):
    jobs = (
        db.query(Job)
        .filter(Job.type == "RECOVERY_OPTIMIZATION")
        .order_by(Job.created_at.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )
    return {
        "runs": [
            {
                "job_id": str(job.id),
                "status": job.status.value,
                "created_at": job.created_at.isoformat() if job.created_at else None,
                "optimization_status": (job.result or {}).get("status") if isinstance(job.result, dict) else None,
            }
            for job in jobs
        ]
    }


@router.get("/{job_id}")
def get_optimization_result(job_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("optimization:read"))):
    job = db.query(Job).filter(Job.id == _parse_uuid(job_id, "job_id")).first()
    if not job:
        raise HTTPException(status_code=404, detail="Optimization job not found")

    return {
        "job_id": str(job.id),
        "status": job.status.value,
        "result": job.result
    }
