from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class ExpectedImpact(BaseModel):
    baseline: Dict[str, Any]
    recommended: Dict[str, Any]
    difference: Dict[str, Any]

class RecommendationDetail(BaseModel):
    status: str
    strategy_id: Optional[str]
    strategy_name: Optional[str]
    objective: Optional[str]
    reason: Optional[str]

class CausalLink(BaseModel):
    cause: str
    effect: str
    evidence: Dict[str, Any]

class EvidenceItem(BaseModel):
    source_type: str
    entity: str
    entity_id: Optional[str]
    field: str
    value: Any
    role: str

class AssumptionItem(BaseModel):
    assumption: str
    value: Any
    reason: str
    source: str

class ConfidenceDetail(BaseModel):
    level: str
    basis: List[str]

class ProvenanceDetail(BaseModel):
    input: str
    source: str
    entity: str
    calculation: str
    engine: str

class AlternativeStrategy(BaseModel):
    strategy: str
    feasibility: str
    objective_value: Optional[Dict[str, Any]]
    shortage: Optional[float]

class ScenarioExplainabilityResponse(BaseModel):
    scenario_id: str
    recommendation: RecommendationDetail
    expected_impact: ExpectedImpact
    primary_drivers: List[str]
    causal_chain: List[CausalLink]
    evidence: List[EvidenceItem]
    assumptions: List[AssumptionItem]
    uncertainty: Dict[str, Any]
    alternatives: List[AlternativeStrategy]
    limitations: List[str]
    confidence: ConfidenceDetail
    provenance: List[ProvenanceDetail]
    methodology: str
