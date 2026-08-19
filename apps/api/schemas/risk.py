from pydantic import BaseModel, Field
from typing import List, Optional, Any
from datetime import datetime

class RiskTrendPoint(BaseModel):
    timestamp: datetime
    score: float
    level: str
    entity_id: str
    source_event_id: Optional[str] = None

class RiskTrendResponse(BaseModel):
    data: List[RiskTrendPoint]

class RiskExposureNode(BaseModel):
    id: str
    name: str
    type: str

class RiskExposureResponse(BaseModel):
    entity_id: str
    dependent_countries: List[RiskExposureNode]
    exposed_suppliers: List[RiskExposureNode]
    routes_affected: List[RiskExposureNode]
    downstream_assets: List[RiskExposureNode]

class RiskEvaluationResponse(BaseModel):
    systemic_risk_score: float
    active_critical_risks: int
    active_high_risks: int
    affected_entities: int
    affected_routes: int
    affected_chokepoints: int
    affected_suppliers: int
    event_count: int
    highest_severity_event: Optional[str] = None
    latest_evaluation_timestamp: Optional[datetime] = None
    status: str = "ok"

class EntityRiskDetail(BaseModel):
    entity_id: str
    latest_score: float
    level: str
    timestamp: datetime

class EntityRiskResponse(BaseModel):
    entity: EntityRiskDetail
    history: List[RiskTrendPoint]
    active_events: List[Any]
    exposures: RiskExposureResponse
