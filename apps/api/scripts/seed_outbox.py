import sys
import os
import uuid
import json

root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(root_dir, "apps", "api"))
sys.path.insert(0, root_dir)

from core.database import SessionLocal
from models.domain import (
    Country, Commodity, Supplier, Route, Chokepoint, EnergyAsset, 
    TradeFlow, GeopoliticalEvent, RiskScore, OutboxEvent, EventType
)

def emit_outbox(db, aggregate_type, aggregate_id, payload):
    event = OutboxEvent(
        aggregate_type=aggregate_type,
        aggregate_id=str(aggregate_id),
        event_type=EventType.CREATE,
        payload=payload
    )
    db.add(event)

def run():
    db = SessionLocal()
    try:
        # Clear existing outbox events to prevent duplicates
        db.query(OutboxEvent).delete()
        
        for c in db.query(Country).all():
            emit_outbox(db, "Country", c.id, {"id": c.id, "name": c.name})
            
        for c in db.query(Commodity).all():
            emit_outbox(db, "Commodity", c.id, {"id": c.id, "name": c.name})
            
        for s in db.query(Supplier).all():
            emit_outbox(db, "Supplier", s.id, {"id": s.id, "name": s.name, "country_id": s.country_id})
            
        for r in db.query(Route).all():
            emit_outbox(db, "Route", r.id, {"id": r.id, "name": r.name, "capacity": r.capacity})
            
        for c in db.query(Chokepoint).all():
            emit_outbox(db, "Chokepoint", c.id, {"id": c.id, "name": c.name})
            
        for a in db.query(EnergyAsset).all():
            emit_outbox(db, "EnergyAsset", a.id, {"id": a.id, "name": a.name, "type": a.type, "capacity": a.capacity, "country_id": a.country_id})
            
        for t in db.query(TradeFlow).all():
            emit_outbox(db, "TradeFlow", t.id, {
                "id": str(t.id), 
                "volume": t.volume, 
                "supplier_id": t.supplier_id, 
                "destination_country_id": t.destination_country_id,
                "route_id": t.route_id,
                "commodity_id": t.commodity_id
            })
            
        for e in db.query(GeopoliticalEvent).all():
            emit_outbox(db, "GeopoliticalEvent", e.id, {
                "source_event_id": e.source_event_id,
                "title": e.title,
                "event_type": e.type,
                "severity": e.severity,
                "confidence": e.confidence,
                "affected_entity_id": e.affected_entity_id,
                "source_id": e.source_id,
                "latitude": e.latitude,
                "longitude": e.longitude
            })
            
        for r in db.query(RiskScore).all():
            emit_outbox(db, "RiskScore", r.id, {
                "entity_id": r.entity_id,
                "score": r.score,
                "level": r.level.name if r.level else "MEDIUM"
            })
            
        db.commit()
        print("Outbox seeded.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run()
