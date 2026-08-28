from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from pydantic import BaseModel
from typing import Dict, Any, Optional
import uuid
from datetime import datetime, timezone

from core.database import get_db
from models.domain import DecisionAudit, Scenario
from core.security import RequirePermissions, User

router = APIRouter(prefix="/api/v1/decisions", tags=["Decisions"])

class DecisionActionRequest(BaseModel):
    decision_version: Optional[str] = None
    reason: Optional[str] = None
    comment: Optional[str] = None

def _create_audit(db: Session, scenario_id: str, action: str, reason: str, comment: str, actor_id: str = "authorized_user"):
    # Mocking snapshot from the current time as we don't have a specific versioning engine installed
    snapshot = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "state_at_decision": "Validated by Backend"
    }
    
    audit = DecisionAudit(
        scenario_id=scenario_id,
        status=action,
        actor_id=actor_id,
        reason=reason,
        decision_snapshot=snapshot,
        action_plan={"comment": comment} if comment else {}
    )
    db.add(audit)
    return audit

class CreateDecisionRequest(BaseModel):
    scenario_id: str
    recommendation_id: Optional[str] = None
    status: Optional[str] = "PENDING"
    reason: Optional[str] = None
    action_plan: Optional[Dict[str, Any]] = None

@router.post("", response_model=Dict[str, Any])
def create_decision(req: CreateDecisionRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:review"))):
    audit = DecisionAudit(
        scenario_id=req.scenario_id,
        recommendation_id=req.recommendation_id,
        status=req.status or "PENDING",
        actor_id=user.id,
        reason=req.reason or "Submitted for review",
        action_plan=req.action_plan or {}
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    return {
        "decision_id": str(audit.id),
        "scenario_id": audit.scenario_id,
        "status": audit.status,
        "message": "Decision created successfully"
    }

@router.post("/{scenario_id}/approve")
def approve_decision(scenario_id: str, req: DecisionActionRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:approve"))):
    # 1. Validate scenario exists
    try:
        scenario_uuid = uuid.UUID(scenario_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scenario ID format")

    scenario = db.query(Scenario).filter(Scenario.id == scenario_uuid).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="SCENARIO_NOT_FOUND")

    # 2. Enforce transaction safety
    try:
        # Check current latest status to prevent invalid transitions
        latest_audit = db.query(DecisionAudit).filter(DecisionAudit.scenario_id == scenario_id).order_by(DecisionAudit.timestamp.desc()).first()
        current_status = latest_audit.status if latest_audit else "PENDING"
        
        if current_status == "APPROVED":
            raise HTTPException(status_code=400, detail="ALREADY_DECIDED")
            
        if current_status not in ["PENDING", "REQUEST_REVIEW"]:
            raise HTTPException(status_code=400, detail="INVALID_STATE_TRANSITION")

        _create_audit(db, scenario_id, "APPROVED", req.reason or "Approved", req.comment or "", actor_id=user.id)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="AUDIT_WRITE_FAILED")

    return {"status": "APPROVED", "message": "Decision approved and audited."}

@router.post("/{scenario_id}/reject")
def reject_decision(scenario_id: str, req: DecisionActionRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:reject"))):
    if not req.reason or req.reason.strip() == "":
        raise HTTPException(status_code=400, detail="REASON_REQUIRED")

    try:
        latest_audit = db.query(DecisionAudit).filter(DecisionAudit.scenario_id == scenario_id).order_by(DecisionAudit.timestamp.desc()).first()
        current_status = latest_audit.status if latest_audit else "PENDING"
        
        if current_status == "REJECTED":
            raise HTTPException(status_code=400, detail="ALREADY_DECIDED")
            
        if current_status not in ["PENDING", "REQUEST_REVIEW"]:
            raise HTTPException(status_code=400, detail="INVALID_STATE_TRANSITION")

        _create_audit(db, scenario_id, "REJECTED", req.reason, req.comment or "", actor_id=user.id)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="AUDIT_WRITE_FAILED")

    return {"status": "REJECTED", "message": "Decision rejected and audited."}

@router.post("/{scenario_id}/review")
def review_decision(scenario_id: str, req: DecisionActionRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:review"))):
    if not req.reason or req.reason.strip() == "":
        raise HTTPException(status_code=400, detail="REASON_REQUIRED")

    try:
        latest_audit = db.query(DecisionAudit).filter(DecisionAudit.scenario_id == scenario_id).order_by(DecisionAudit.timestamp.desc()).first()
        current_status = latest_audit.status if latest_audit else "PENDING"

        # Even if currently in REQUEST_REVIEW, another review can be requested. But not if approved/rejected.
        if current_status in ["APPROVED", "REJECTED"]:
            raise HTTPException(status_code=400, detail="INVALID_STATE_TRANSITION")

        _create_audit(db, scenario_id, "REQUEST_REVIEW", req.reason, req.comment or "", actor_id=user.id)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="AUDIT_WRITE_FAILED")

    return {"status": "REQUEST_REVIEW", "message": "Decision review requested and audited."}

@router.get("/{scenario_id}/audit")
def get_decision_audit(scenario_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:read"))):
    audits = db.query(DecisionAudit).filter(DecisionAudit.scenario_id == scenario_id).order_by(DecisionAudit.timestamp.desc()).all()
    
    return [
        {
            "id": str(a.id),
            "status": a.status,
            "actor_id": a.actor_id,
            "reason": a.reason,
            "comment": a.action_plan.get("comment", "") if a.action_plan else "",
            "timestamp": a.timestamp.isoformat() if a.timestamp else None
        }
        for a in audits
    ]

# Keep compatibility with old UI if needed for response orchestrator fallback, but mainly rely on above.
@router.get("/pending")
def get_pending_decisions(db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:read"))):
    # Quick hack to get the latest status per scenario and return if it's PENDING or REQUEST_REVIEW
    # In a real app we'd use a window function or distinct on.
    audits = db.query(DecisionAudit).order_by(DecisionAudit.timestamp.desc()).all()
    
    latest_status_by_scenario = {}
    pending_list = []
    
    for a in audits:
        if a.scenario_id not in latest_status_by_scenario:
            latest_status_by_scenario[a.scenario_id] = a.status
            if a.status in ["PENDING", "REQUEST_REVIEW"]:
                pending_list.append({
                    "id": str(a.id), # using audit ID or scenario ID as reference
                    "scenario_id": a.scenario_id,
                    "status": a.status,
                    "timestamp": a.timestamp.isoformat() if a.timestamp else None
                })
                
    return pending_list

@router.get("/{id}")
def get_decision(id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:read"))):
    try:
        decision_uuid = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid decision ID format")
        
    decision = db.query(DecisionAudit).filter(DecisionAudit.id == decision_uuid).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
        
    return {
        "id": str(decision.id),
        "scenario_id": decision.scenario_id,
        "recommendation_id": decision.recommendation_id,
        "status": decision.status,
        "action_plan": decision.action_plan,
        "timestamp": decision.timestamp.isoformat() if decision.timestamp else None
    }

