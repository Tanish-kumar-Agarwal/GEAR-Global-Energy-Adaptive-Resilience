import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

from core.database import get_db
from models.domain import DecisionAudit
from services.response_service import ResponseOrchestratorService
from core.security import RequirePermissions, User

router = APIRouter(prefix="/api/v1/response", tags=["Response Orchestrator"])

@router.get("/{scenario_id}")
def get_master_response(scenario_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:read"))):
    svc = ResponseOrchestratorService(db)
    response_obj = svc.get_master_response(scenario_id)
    return response_obj.model_dump()

class ReviewRequest(BaseModel):
    note: str

def _validate_decision(id: str, db: Session) -> DecisionAudit:
    decision_uuid = uuid.UUID(id)
    decision = db.query(DecisionAudit).filter(DecisionAudit.id == decision_uuid).first()
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision

def _audit_transition(decision: DecisionAudit, new_status: str, action: str, db: Session):
    # Enforce Immutability by creating a new DecisionAudit entry with the new state
    new_audit = DecisionAudit(
        scenario_id=decision.scenario_id,
        recommendation_id=decision.recommendation_id,
        status=new_status,
        action_plan=decision.action_plan,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(new_audit)
    db.commit()
    db.refresh(new_audit)
    return new_audit

@router.post("/{decision_id}/approve")
def approve_decision(decision_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:approve"))):
    decision = _validate_decision(decision_id, db)
    if decision.status in ["APPROVED", "REJECTED", "EXECUTED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot transition from {decision.status} to APPROVED")
    
    updated = _audit_transition(decision, "APPROVED", "approve", db)
    return {"status": "SUCCESS", "decision_id": str(updated.id), "new_status": updated.status}

@router.post("/{decision_id}/reject")
def reject_decision(decision_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:reject"))):
    decision = _validate_decision(decision_id, db)
    if decision.status in ["APPROVED", "REJECTED", "EXECUTED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot transition from {decision.status} to REJECTED")
    
    updated = _audit_transition(decision, "REJECTED", "reject", db)
    return {"status": "SUCCESS", "decision_id": str(updated.id), "new_status": updated.status}

@router.post("/{decision_id}/review")
def review_decision(decision_id: str, req: ReviewRequest, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:review"))):
    decision = _validate_decision(decision_id, db)
    if decision.status in ["APPROVED", "EXECUTED", "CANCELLED"]:
        raise HTTPException(status_code=400, detail=f"Cannot transition from {decision.status} to UNDER_REVIEW")
    
    plan = decision.action_plan or {}
    plan["review_note"] = req.note
    decision.action_plan = plan
    
    updated = _audit_transition(decision, "UNDER_REVIEW", "review", db)
    return {"status": "SUCCESS", "decision_id": str(updated.id), "new_status": updated.status}

@router.get("/{decision_id}/audit")
def get_decision_audit(decision_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("decision:read"))):
    decision = _validate_decision(decision_id, db)
    # Return audit trail for this scenario
    audits = db.query(DecisionAudit).filter(
        DecisionAudit.scenario_id == decision.scenario_id
    ).order_by(DecisionAudit.timestamp.asc()).all()
    
    return {
        "decision_id": decision_id,
        "history": [
            {
                "audit_id": str(a.id),
                "status": a.status,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "action_plan": a.action_plan
            }
            for a in audits
        ]
    }
