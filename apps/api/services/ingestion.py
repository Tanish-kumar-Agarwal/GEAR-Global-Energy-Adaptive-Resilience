import uuid
from datetime import datetime, timezone
import json
from typing import Dict, Any, List, Optional
import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from models.domain import GeopoliticalEvent, RiskScore, RiskLevel, OutboxEvent, EventType, Country, Chokepoint, EnergyAsset

logger = logging.getLogger(__name__)

# ---------------------------------------------------------
# ADAPTER INTERFACES
# ---------------------------------------------------------

class BaseSourceAdapter:
    def fetch_events(self) -> List[Dict[str, Any]]:
        raise NotImplementedError

class DeterministicDemoAdapter(BaseSourceAdapter):
    """
    Simulated static source feed for MVP demonstration.
    Returns highly structured deterministic events.
    """
    def fetch_events(self) -> List[Dict[str, Any]]:
        return [
            {
                "source": "SIM-ACLED",
                "source_event_id": "EV-2025-05-24-001",
                "event_type": "Naval Harassment",
                "title": "Tanker intercepted near Strait of Hormuz",
                "description": "A VLCC tanker was briefly boarded by fast attack craft.",
                "event_time": datetime.now(timezone.utc).isoformat(),
                "latitude": 26.56,
                "longitude": 56.25,
                "country_reference": "IRN",
                "severity": 0.85,
                "confidence": 0.9,
                "raw_payload": {"vessel_type": "VLCC", "flag": "LBR"}
            },
            {
                "source": "SIM-GDELT",
                "source_event_id": "EV-2025-05-24-002",
                "event_type": "Policy Change",
                "title": "Export Tariffs increased",
                "description": "Major policy shift impacting oil exports.",
                "event_time": datetime.now(timezone.utc).isoformat(),
                "latitude": 24.0,
                "longitude": 45.0,
                "country_reference": "SAU",
                "severity": 0.4,
                "confidence": 0.95,
                "raw_payload": {"policy_area": "energy", "tone": -4.5}
            },
            # Malformed event to test error handling
            {
                "source": "SIM-AIS",
                "source_event_id": "EV-2025-05-24-003",
                "event_type": "Anomaly",
                # Missing title, severity, latitude
                "description": "Vessel stopped broadcasting AIS.",
            }
        ]

# ---------------------------------------------------------
# INGESTION SERVICE
# ---------------------------------------------------------

class IngestionService:
    def __init__(self, db: Session, adapter: BaseSourceAdapter):
        self.db = db
        self.adapter = adapter
        self.stats = {
            "received": 0,
            "accepted": 0,
            "rejected": 0,
            "resolved": 0,
            "unresolved": 0,
            "risk_scores_created": 0,
            "outbox_events_created": 0
        }

    def _normalize(self, raw_event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            # Validate required fields
            required = ["source", "source_event_id", "event_type", "title", "severity", "confidence"]
            for req in required:
                if req not in raw_event:
                    raise ValueError(f"Missing required field: {req}")

            return {
                "source": raw_event["source"],
                "source_event_id": raw_event["source_event_id"],
                "event_type": raw_event["event_type"],
                "title": raw_event["title"],
                "description": raw_event.get("description", ""),
                "event_time": raw_event.get("event_time", datetime.now(timezone.utc).isoformat()),
                "latitude": raw_event.get("latitude"),
                "longitude": raw_event.get("longitude"),
                "country_reference": raw_event.get("country_reference"),
                "severity": float(raw_event["severity"]),
                "confidence": float(raw_event["confidence"]),
                "raw_payload": raw_event.get("raw_payload", {})
            }
        except Exception as e:
            logger.warning(f"Failed to normalize event {raw_event.get('source_event_id', 'UNKNOWN')}: {str(e)}")
            return None

    def _resolve_entity(self, normalized_event: Dict[str, Any]) -> Optional[str]:
        # 1. Try to resolve to a Chokepoint based on location/title
        title = normalized_event["title"].lower()
        if "hormuz" in title:
            chokepoint = self.db.query(Chokepoint).filter(Chokepoint.id == "CHK_HORMUZ").first()
            if chokepoint:
                return chokepoint.id
        
        # 2. Try to resolve Country
        country_ref = normalized_event.get("country_reference")
        if country_ref:
            country = self.db.query(Country).filter(Country.id == country_ref).first()
            if country:
                return country.id
                
        # 3. Could add EnergyAsset resolution by lat/lng bounding box, omitted for MVP simplicity
        return None

    def _calculate_risk(self, severity: float, confidence: float, entity_id: Optional[str]) -> tuple[float, RiskLevel]:
        """
        Deterministic Risk Formula:
        Base Risk = Severity * Confidence
        If affecting a known entity, apply a 1.2x multiplier.
        """
        base_risk = severity * confidence
        
        if entity_id:
            base_risk *= 1.2
            
        final_score = min(base_risk * 100, 100.0) # Scale to 0-100
        
        if final_score >= 80:
            level = RiskLevel.CRITICAL
        elif final_score >= 60:
            level = RiskLevel.HIGH
        elif final_score >= 30:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW
            
        return final_score, level

    def run_ingestion(self) -> Dict[str, int]:
        self.stats = {
            "received": 0,
            "accepted": 0,
            "rejected": 0,
            "resolved": 0,
            "unresolved": 0,
            "risk_scores_created": 0,
            "outbox_events_created": 0
        }
        
        raw_events = self.adapter.fetch_events()
        self.stats["received"] = len(raw_events)
        
        for raw in raw_events:
            normalized = self._normalize(raw)
            if not normalized:
                self.stats["rejected"] += 1
                continue
                
            # Idempotency check
            existing = self.db.query(GeopoliticalEvent).filter(
                GeopoliticalEvent.source_event_id == normalized["source_event_id"]
            ).first()
            
            if existing:
                logger.info(f"Skipping duplicate event: {normalized['source_event_id']}")
                self.stats["rejected"] += 1
                continue
                
            self.stats["accepted"] += 1
            
            # Entity Resolution
            entity_id = self._resolve_entity(normalized)
            if entity_id:
                self.stats["resolved"] += 1
            else:
                self.stats["unresolved"] += 1
                
            # Risk Calculation
            risk_score_val, risk_level = self._calculate_risk(normalized["severity"], normalized["confidence"], entity_id)
            
            # Persistence
            event_record = GeopoliticalEvent(
                type=normalized["event_type"],
                title=normalized["title"],
                description=normalized["description"],
                location=normalized["country_reference"] or "Global",
                latitude=normalized["latitude"],
                longitude=normalized["longitude"],
                severity=normalized["severity"],
                confidence=normalized["confidence"],
                affected_entity_id=entity_id,
                source_id=normalized["source"],
                source_event_id=normalized["source_event_id"],
                raw_payload=normalized["raw_payload"],
                timestamp=datetime.fromisoformat(normalized["event_time"].replace('Z', '+00:00'))
            )
            self.db.add(event_record)
            
            # Add outbox event for Neo4j projection (GeopoliticalEvent)
            self.db.add(OutboxEvent(
                aggregate_type="GeopoliticalEvent",
                aggregate_id=normalized["source_event_id"], # We will use source_event_id
                event_type=EventType.CREATE,
                payload={
                    "source_event_id": normalized["source_event_id"],
                    "source_id": normalized["source"],
                    "event_type": normalized["event_type"],
                    "title": normalized["title"],
                    "severity": normalized["severity"],
                    "confidence": normalized["confidence"],
                    "event_time": normalized["event_time"],
                    "latitude": normalized["latitude"],
                    "longitude": normalized["longitude"],
                    "affected_entity_id": entity_id
                }
            ))
            self.stats["outbox_events_created"] += 1
            
            # If resolved to an entity, create a RiskScore record
            if entity_id:
                risk_record = RiskScore(
                    entity_id=entity_id,
                    score=risk_score_val,
                    level=risk_level,
                    factors={"severity": normalized["severity"], "confidence": normalized["confidence"]},
                    confidence=normalized["confidence"],
                    model_version="MVP-v1"
                )
                self.db.add(risk_record)
                self.stats["risk_scores_created"] += 1
                
                # Add outbox event for Neo4j projection (RiskScore)
                self.db.add(OutboxEvent(
                    aggregate_type="RiskScore",
                    aggregate_id=entity_id,
                    event_type=EventType.UPDATE,
                    payload={
                        "entity_id": entity_id,
                        "score": risk_score_val,
                        "level": risk_level.value
                    }
                ))
                self.stats["outbox_events_created"] += 1

        try:
            self.db.commit()
        except SQLAlchemyError as e:
            self.db.rollback()
            logger.error(f"Database unavailable during ingestion commit: {e}")
            raise e
            
        return self.stats
