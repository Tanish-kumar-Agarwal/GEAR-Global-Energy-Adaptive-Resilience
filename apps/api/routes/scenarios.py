from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Dict, Any
from datetime import datetime, timezone
import json
import time
import uuid

from core.database import get_db
from models.domain import Scenario, Job, JobStatus
from simulation.monte_carlo.runner import run_monte_carlo
from simulation.cascade.impact import compute_geo_impact
from models.domain import TradeFlow
from core.security import RequirePermissions, User

router = APIRouter(prefix="/api/v1/scenarios", tags=["Scenarios"])

class ScenarioCreateRequest(BaseModel):
    name: str
    target_id: str
    severity: float
    duration_days: int

from workers.tasks import execute_scenario_simulation

class ScenarioPreviewRequest(BaseModel):
    target_id: str
    severity: float = Field(ge=0.0, le=1.0)
    duration_days: int = Field(default=30, ge=0)

# Baseline at or above this leaves so little headroom below the 100 cap that
# the severity slider visibly cannot move the score. Surfaced as "saturated"
# so the UI can explain the flat line instead of looking broken.
SATURATION_BASELINE = 90.0

@router.post("/preview")
def preview_scenario(req: ScenarioPreviewRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("scenario:execute"))):
    """Synchronous, queue-free approximation of a scenario run for live sliders.

    Same escalation model as the real engine (simulation.cascade.impact,
    stacked on live baseline risk), with one simplification: the Monte Carlo
    cascade is skipped, so affected_route_ids is empty and routes enter the
    overlay only through their chokepoint linkage. A full run can therefore
    include additional routes that only the graph cascade reaches; scores for
    the routes both paths cover are computed by the same code and match.
    """
    started = time.perf_counter()
    impact = compute_geo_impact(
        db, req.target_id, req.severity, req.duration_days, include_base=True
    )

    saturated = []
    impacted_routes = []
    for entry in impact["impacted_routes"]:
        if entry["base_score"] >= SATURATION_BASELINE:
            saturated.append(entry["route_id"])
        impacted_routes.append(
            {"route_id": entry["route_id"], "risk_score": entry["risk_score"], "status": entry["status"]}
        )
    impacted_chokepoints = []
    for entry in impact["impacted_chokepoints"]:
        if entry["base_score"] >= SATURATION_BASELINE:
            saturated.append(entry["chokepoint_id"])
        impacted_chokepoints.append(
            {"chokepoint_id": entry["chokepoint_id"], "risk_score": entry["risk_score"], "status": entry["status"]}
        )

    return {
        "status": "ok",
        "mode": "preview",
        "is_estimate": True,
        "method": "geo-impact-no-cascade",
        "computed_ms": round((time.perf_counter() - started) * 1000.0, 1),
        "impacted_routes": impacted_routes,
        "impacted_chokepoints": impacted_chokepoints,
        "saturated": saturated,
    }

@router.post("")
def create_scenario(req: ScenarioCreateRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("scenario:create"))):
    scenario = Scenario(
        name=req.name,
        parameters={"target_id": req.target_id, "severity": req.severity, "duration": req.duration_days}
    )
    db.add(scenario)
    db.commit()
    return {"id": scenario.id, "message": "Scenario created"}

# A QUEUED job older than this has no live worker coming for it; /results
# marks it FAILED instead of letting the client spin forever.
QUEUED_JOB_TIMEOUT_SECONDS = 300

def _queue_has_worker(timeout: float = 1.5) -> bool:
    """True if at least one Celery worker is consuming our task queue.

    A reachable broker is not enough: with no worker on the queue a dispatched
    job sits QUEUED forever while the UI shows a dead spinner. Kept short so
    /run stays snappy; on any inspection error we report the queue as down.
    """
    from workers.celery_app import celery_app
    try:
        queues = celery_app.control.inspect(timeout=timeout).active_queues() or {}
        target = celery_app.conf.task_default_queue
        return any(q.get("name") == target for qs in queues.values() for q in (qs or []))
    except Exception:
        return False

@router.post("/{id}/run", status_code=202)
def run_scenario(id: str, sync_fallback: bool = False, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("scenario:execute"))):
    scenario_id = uuid.UUID(id)
    scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    if sync_fallback:
        # Explicit local-dev escape hatch when the queue is down. The run is
        # executed inline and both the response and the stored result are
        # flagged so the UI can label it; it is never presented as a real
        # queued run.
        job = Job(type="SCENARIO_SIMULATION")
        db.add(job)
        db.flush()
        scenario.job_id = job.id
        db.commit()
        execute_scenario_simulation(
            str(job.id),
            scenario.parameters["target_id"],
            scenario.parameters["severity"],
            scenario.parameters.get("duration", 30)
        )
        db.refresh(job)
        if isinstance(job.result, dict):
            job.result = {**job.result, "execution_mode": "sync_fallback"}
            db.commit()
        return {
            "job_id": job.id,
            "status": job.status.value,
            "execution_mode": "sync_fallback",
            "warning": "Executed synchronously in the API process, not via the job queue."
        }

    # Fail fast before creating a job the queue will never pick up. The
    # sync_fallback escape hatch stays explicit and opt-in; this only makes
    # the queue-down case honest instead of a 60-second dead spinner.
    if not _queue_has_worker():
        raise HTTPException(
            status_code=503,
            detail={
                "status": "failed",
                "error_code": "QUEUE_UNAVAILABLE",
                "component": "celery_worker",
                "message": "No worker is consuming the scenario queue. Start a Celery worker or retry with ?sync_fallback=true for a local inline run.",
                "retryable": True
            }
        )

    job = Job(type="SCENARIO_SIMULATION")
    db.add(job)
    db.flush()
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

    # A job still QUEUED long after dispatch means the worker died mid-flight
    # (the pre-dispatch check only proves one existed at submit time). Fail it
    # here so no client polls a dead spinner forever.
    if job.status == JobStatus.QUEUED and job.created_at is not None:
        created = job.created_at if job.created_at.tzinfo else job.created_at.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - created).total_seconds()
        if age > QUEUED_JOB_TIMEOUT_SECONDS:
            job.status = JobStatus.FAILED
            job.error = json.dumps({
                "status": "failed",
                "error": {
                    "code": "QUEUE_TIMEOUT",
                    "message": f"Job sat QUEUED for over {QUEUED_JOB_TIMEOUT_SECONDS}s; no worker picked it up.",
                    "component": "celery",
                    "retryable": True,
                }
            })
            db.commit()

    return {
        "scenario_id": scenario.id,
        "job_status": job.status.value,
        "results": job.result,
        # Surfaced so a failed job can explain itself in the UI instead of a generic message.
        "error": job.error,
    }
