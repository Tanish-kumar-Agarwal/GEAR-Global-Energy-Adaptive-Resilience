from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import datetime
import sys
import os

from models.domain import RiskScore, GeopoliticalEvent
from schemas.risk import RiskTrendPoint, RiskExposureResponse, RiskExposureNode, RiskEvaluationResponse, EntityRiskDetail, EntityRiskResponse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
from graph.queries.digital_twin import (
    get_dependent_countries, 
    get_exposed_suppliers, 
    get_routes_through_chokepoint, 
    get_downstream_assets,
    get_geopolitical_events_affecting_node,
    get_risk_scores_for_node
)

class RiskService:
    def __init__(self, db: Session):
        self.db = db
        
    def get_trend(self, entity_id: Optional[str] = None, limit: int = 100) -> List[RiskTrendPoint]:
        query = self.db.query(RiskScore)
        if entity_id:
            query = query.filter(RiskScore.entity_id == entity_id)
            
        records = query.order_by(RiskScore.timestamp.asc()).limit(limit).all()
        
        # If no records exist, return empty, don't fabricate
        points = []
        for r in records:
            points.append(RiskTrendPoint(
                timestamp=r.timestamp,
                score=r.score,
                level=r.level,
                entity_id=r.entity_id
            ))
        return points
        
    def get_exposures(self, entity_id: str) -> RiskExposureResponse:
        # Fallback empty lists if Neo4j is offline or entity not found
        try:
            countries_res = get_dependent_countries(entity_id)
            countries = [RiskExposureNode(id=r["Country"], name=r.get("Name", r["Country"]), type="Country") for r in countries_res]
        except Exception:
            countries = []
            
        try:
            suppliers_res = get_exposed_suppliers(entity_id)
            suppliers = [RiskExposureNode(id=r["Supplier"], name=r.get("Name", r["Supplier"]), type="Supplier") for r in suppliers_res]
        except Exception:
            suppliers = []
            
        try:
            routes_res = get_routes_through_chokepoint(entity_id)
            routes = [RiskExposureNode(id=r["Route"], name=r.get("Name", r["Route"]), type="Route") for r in routes_res]
        except Exception:
            routes = []
            
        try:
            assets_res = get_downstream_assets(entity_id)
            assets = [RiskExposureNode(id=r["Asset"], name=r.get("Name", r["Asset"]), type="Asset") for r in assets_res]
        except Exception:
            assets = []
            
        return RiskExposureResponse(
            entity_id=entity_id,
            dependent_countries=countries,
            exposed_suppliers=suppliers,
            routes_affected=routes,
            downstream_assets=assets
        )
        
    def get_evaluation(self) -> RiskEvaluationResponse:
        # Aggregate from PostgreSQL
        avg_score = self.db.query(func.avg(RiskScore.score)).scalar() or 0.0
        critical_count = self.db.query(RiskScore).filter(RiskScore.level == "CRITICAL").count()
        high_count = self.db.query(RiskScore).filter(RiskScore.level == "HIGH").count()
        event_count = self.db.query(GeopoliticalEvent).count()
        
        highest_event = self.db.query(GeopoliticalEvent).order_by(GeopoliticalEvent.severity.desc()).first()
        highest_severity_title = highest_event.title if highest_event else None
        
        latest_risk = self.db.query(RiskScore).order_by(RiskScore.timestamp.desc()).first()
        latest_time = latest_risk.timestamp if latest_risk else None
        
        return RiskEvaluationResponse(
            systemic_risk_score=float(avg_score),
            active_critical_risks=critical_count,
            active_high_risks=high_count,
            affected_entities=critical_count + high_count, # Simplification
            affected_routes=0, # Graph aggregation could be done here if needed
            affected_chokepoints=0,
            affected_suppliers=0,
            event_count=event_count,
            highest_severity_event=highest_severity_title,
            latest_evaluation_timestamp=latest_time,
            status="ok"
        )
        
    def get_entity_risk(self, entity_id: str) -> Optional[EntityRiskResponse]:
        latest_risk = self.db.query(RiskScore).filter(RiskScore.entity_id == entity_id).order_by(RiskScore.timestamp.desc()).first()
        if not latest_risk:
            return None
            
        detail = EntityRiskDetail(
            entity_id=latest_risk.entity_id,
            latest_score=latest_risk.score,
            level=latest_risk.level,
            timestamp=latest_risk.timestamp
        )
        
        history = self.get_trend(entity_id=entity_id)
        active_events = self.db.query(GeopoliticalEvent).filter(GeopoliticalEvent.affected_entity_id == entity_id).all()
        
        exposures = self.get_exposures(entity_id=entity_id)
        
        return EntityRiskResponse(
            entity=detail,
            history=history,
            active_events=[{"title": e.title, "severity": e.severity} for e in active_events],
            exposures=exposures
        )
