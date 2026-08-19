from fastapi import APIRouter, Depends, HTTPException, Query
from core.security import RequirePermissions, User
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from services.risk_service import RiskService
from schemas.risk import (
    RiskTrendResponse, 
    RiskExposureResponse, 
    RiskEvaluationResponse, 
    EntityRiskResponse
)

router = APIRouter(prefix="/api/v1/risks", tags=["risks"])

@router.get("/trend", response_model=RiskTrendResponse)
def get_risk_trend(
    entity_id: Optional[str] = Query(None, description="Filter by entity ID"),
    db: Session = Depends(get_db),
    user: User = Depends(RequirePermissions("risk:read"))
):
    service = RiskService(db)
    points = service.get_trend(entity_id=entity_id)
    return RiskTrendResponse(data=points)

@router.get("/exposures", response_model=RiskExposureResponse)
def get_risk_exposures(
    entity_id: str = Query("CHK_HORMUZ", description="Entity ID to analyze exposures for"),
    db: Session = Depends(get_db),
    user: User = Depends(RequirePermissions("risk:read"))
):
    # In a real app this would take the entity_id or evaluate systemic exposure
    # We default to CHK_HORMUZ for the MVP to render useful data
    service = RiskService(db)
    return service.get_exposures(entity_id)

@router.get("/evaluation", response_model=RiskEvaluationResponse)
def get_risk_evaluation(db: Session = Depends(get_db), user: User = Depends(RequirePermissions("risk:read"))):
    service = RiskService(db)
    return service.get_evaluation()

@router.get("/entity/{entity_id}", response_model=EntityRiskResponse)
def get_entity_risk(entity_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("risk:read"))):
    service = RiskService(db)
    res = service.get_entity_risk(entity_id)
    if not res:
        raise HTTPException(status_code=404, detail="Entity risk profile not found")
    return res

@router.get("/categories")
def get_risk_categories(user: User = Depends(RequirePermissions("risk:read"))):
    return {"status": "data_unavailable", "message": "Risk categories breakdown unavailable."}

@router.get("/heatmap")
def get_risk_heatmap(user: User = Depends(RequirePermissions("risk:read"))):
    return {"status": "data_unavailable", "message": "Risk heatmap coordinates unavailable."}

@router.get("/{risk_id}")
def get_risk_by_id(risk_id: str, db: Session = Depends(get_db), user: User = Depends(RequirePermissions("risk:read"))):
    # Simple pass-through for now, or could return full history
    service = RiskService(db)
    # The requirement asks for GET /api/v1/risks/{risk_id}
    from models.domain import RiskScore
    risk = db.query(RiskScore).filter(RiskScore.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")
    return {
        "id": risk.id,
        "entity_id": risk.entity_id,
        "score": risk.score,
        "level": risk.level,
        "timestamp": risk.timestamp
    }

