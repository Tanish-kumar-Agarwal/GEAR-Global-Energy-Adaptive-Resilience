from fastapi import APIRouter, Depends, HTTPException, Query
from core.security import RequirePermissions, User
from sqlalchemy.orm import Session
from typing import Optional

from core.database import get_db
from services.intelligence_service import IntelligenceService
from services.explainability_service import ExplainabilityService
from schemas.intelligence import (
    IntelligenceEventResponse, 
    IntelligenceEventListResponse,
    ExplainabilityResponse
)
from schemas.explainability import ScenarioExplainabilityResponse

router = APIRouter(prefix="/api/v1/intelligence", tags=["intelligence"])

@router.get("/events", response_model=IntelligenceEventListResponse)
def get_intelligence_events(
    skip: int = Query(0, description="Pagination skip"),
    limit: int = Query(50, description="Pagination limit"),
    db: Session = Depends(get_db)
):
    service = IntelligenceService(db)
    events, total = service.get_events(skip=skip, limit=limit)
    
    data = []
    for e in events:
        data.append(IntelligenceEventResponse(
            id=str(e.id),
            source_id=e.source_id,
            source_event_id=e.source_event_id,
            type=e.type,
            title=e.title,
            description=e.description,
            severity=e.severity,
            confidence=e.confidence,
            timestamp=e.timestamp,
            latitude=e.latitude,
            longitude=e.longitude,
            affected_entity_id=e.affected_entity_id,
            ingestion_time=e.ingestion_time,
            raw_payload=None # Do not expose raw payload in list view for size reasons
        ))
        
    return IntelligenceEventListResponse(data=data, total=total)

@router.get("/events/{event_id}", response_model=IntelligenceEventResponse)
def get_intelligence_event(event_id: str, db: Session = Depends(get_db)):
    service = IntelligenceService(db)
    e = service.get_event(event_id)
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
        
    return IntelligenceEventResponse(
        id=str(e.id),
        source_id=e.source_id,
        source_event_id=e.source_event_id,
        type=e.type,
        title=e.title,
        description=e.description,
        severity=e.severity,
        confidence=e.confidence,
        timestamp=e.timestamp,
        latitude=e.latitude,
        longitude=e.longitude,
        affected_entity_id=e.affected_entity_id,
        ingestion_time=e.ingestion_time,
        raw_payload=e.raw_payload
    )

@router.get("/explainability", response_model=ExplainabilityResponse)
def get_explainability(
    risk_id: str = Query(..., description="RiskScore ID to explain"),
    db: Session = Depends(get_db)
):
    service = IntelligenceService(db)
    explanation = service.get_explainability(risk_id)
    if not explanation:
        raise HTTPException(status_code=404, detail="Explanation could not be generated for this risk score")
        
    return explanation

@router.get("/explainability/scenario/{scenario_id}", response_model=ScenarioExplainabilityResponse)
def get_scenario_explainability(scenario_id: str, db: Session = Depends(get_db)):
    service = ExplainabilityService(db)
    explanation = service.generate_scenario_explainability(scenario_id)
    if not explanation:
        raise HTTPException(status_code=404, detail="Explainability data unavailable or scenario not found")
    return explanation
