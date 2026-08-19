from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime

class IntelligenceEventResponse(BaseModel):
    id: str
    source_id: str
    source_event_id: str
    type: str
    title: str
    description: Optional[str] = None
    severity: Optional[float] = None
    confidence: Optional[float] = None
    timestamp: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    affected_entity_id: Optional[str] = None
    ingestion_time: datetime
    raw_payload: Optional[Dict[str, Any]] = None

class IntelligenceEventListResponse(BaseModel):
    data: List[IntelligenceEventResponse]
    total: int

class ExplainabilityFactor(BaseModel):
    factor: str
    value: Any
    contribution: str
    source: str

class ExplainabilityResponse(BaseModel):
    risk_score: float
    risk_level: str
    factors: List[ExplainabilityFactor]
    evidence: List[Dict[str, Any]]
