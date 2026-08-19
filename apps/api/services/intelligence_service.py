from sqlalchemy.orm import Session
from typing import Optional, List
from models.domain import GeopoliticalEvent, RiskScore
from schemas.intelligence import IntelligenceEventResponse, ExplainabilityResponse, ExplainabilityFactor

class IntelligenceService:
    def __init__(self, db: Session):
        self.db = db
        
    def get_events(self, skip: int = 0, limit: int = 50) -> tuple[List[GeopoliticalEvent], int]:
        total = self.db.query(GeopoliticalEvent).count()
        events = self.db.query(GeopoliticalEvent).order_by(GeopoliticalEvent.timestamp.desc()).offset(skip).limit(limit).all()
        return events, total
        
    def get_event(self, event_id: str) -> Optional[GeopoliticalEvent]:
        return self.db.query(GeopoliticalEvent).filter(GeopoliticalEvent.id == event_id).first()
        
    def get_explainability(self, risk_score_id: str) -> ExplainabilityResponse:
        # Example logic for deterministic explainability based on the model
        risk = self.db.query(RiskScore).filter(RiskScore.id == risk_score_id).first()
        if not risk:
            return None
            
        # Find events targeting this entity to explain it
        events = self.db.query(GeopoliticalEvent).filter(GeopoliticalEvent.affected_entity_id == risk.entity_id).all()
        
        factors = []
        evidence = []
        
        for event in events:
            severity = event.severity or 0.0
            confidence = event.confidence or 0.0
            impact = severity * confidence * 100
            factors.append(ExplainabilityFactor(
                factor="Event Severity & Confidence",
                value=f"Severity: {severity:.2f}, Confidence: {confidence:.2f}",
                contribution=f"+{impact:.1f} to base risk",
                source=f"Event: {event.source_event_id}"
            ))
            evidence.append({
                "source": event.source_id,
                "type": event.type,
                "title": event.title
            })
            
        if not factors:
            factors.append(ExplainabilityFactor(
                factor="Baseline",
                value="No active events",
                contribution="Base risk level",
                source="Historical Baseline"
            ))
            
        return ExplainabilityResponse(
            risk_score=risk.score,
            risk_level=risk.level,
            factors=factors,
            evidence=evidence
        )
