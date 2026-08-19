from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class ProblemContext(BaseModel):
    problem_id: str
    scenario_id: str
    target: str
    severity: float
    duration_days: int
    status: str

class ImpactContext(BaseModel):
    supply_gap: Optional[float]
    economic_impact_total: str
    p10_gap: Optional[float]
    p50_gap: Optional[float]
    p90_gap: Optional[float]
    affected_routes: int
    affected_assets: int
    affected_countries: int

class OptionDetail(BaseModel):
    option_id: str
    option_type: str
    name: str
    description: str
    feasibility: str
    expected_effect: Dict[str, Any]

class RecommendationContext(BaseModel):
    recommendation_id: str
    action_type: str
    recommended_action: str
    priority: str
    expected_physical_impact: Dict[str, Any]
    expected_economic_impact: Dict[str, Any]
    optimization_status: str
    primary_drivers: List[str]

class MasterResponseObject(BaseModel):
    status: str
    problem: ProblemContext
    impact: ImpactContext
    options: List[OptionDetail]
    optimization: Dict[str, Any]
    recommendation: RecommendationContext
    explanation: Dict[str, Any]
    approval: Dict[str, Any]
    alternatives: List[Dict[str, Any]]
    uncertainty: Dict[str, Any]
    assumptions: List[Dict[str, Any]]
    provenance: List[Dict[str, Any]]
    decision_audit: Optional[Dict[str, Any]] = None
