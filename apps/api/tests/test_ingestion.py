import pytest
from unittest.mock import MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.database import Base
from services.ingestion import IngestionService, BaseSourceAdapter
from models.domain import GeopoliticalEvent, RiskScore, OutboxEvent, Chokepoint, Country

# Setup an in-memory SQLite database for testing
engine = create_engine("sqlite:///:memory:")
SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

class MockAdapter(BaseSourceAdapter):
    def __init__(self, events):
        self.events = events
    def fetch_events(self):
        return self.events

@pytest.fixture(scope="function")
def db_session():
    # Recreate tables to ensure clean state
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocalTest()
    
    # Seed required entities for resolution testing
    chk = Chokepoint(id="CHK_HORMUZ", name="Strait of Hormuz", latitude=26.56, longitude=56.25)
    ind = Country(id="IND", name="India", region="South Asia")
    db.add(chk)
    db.add(ind)
    db.commit()
    
    yield db
    db.close()

def test_valid_event_ingestion(db_session):
    events = [{
        "source": "TEST",
        "source_event_id": "EV-1",
        "event_type": "Naval",
        "title": "Hormuz Incident",
        "severity": 0.8,
        "confidence": 0.9,
        "latitude": 26.5,
        "longitude": 56.2
    }]
    svc = IngestionService(db_session, MockAdapter(events))
    stats = svc.run_ingestion()
    
    assert stats["accepted"] == 1
    assert stats["rejected"] == 0
    assert stats["resolved"] == 1  # Resolves to CHK_HORMUZ based on title
    assert stats["outbox_events_created"] == 2 # 1 for Event, 1 for RiskScore
    
    ev = db_session.query(GeopoliticalEvent).first()
    assert ev.source_event_id == "EV-1"
    assert ev.affected_entity_id == "CHK_HORMUZ"

def test_duplicate_event_ingestion(db_session):
    events = [{
        "source": "TEST",
        "source_event_id": "EV-2",
        "event_type": "Political",
        "title": "Election",
        "severity": 0.5,
        "confidence": 0.9
    }]
    svc = IngestionService(db_session, MockAdapter(events))
    
    # Run first time
    stats1 = svc.run_ingestion()
    assert stats1["accepted"] == 1
    
    # Run second time
    stats2 = svc.run_ingestion()
    assert stats2["accepted"] == 0
    assert stats2["rejected"] == 1 # Rejected as duplicate
    
    assert db_session.query(GeopoliticalEvent).count() == 1

def test_malformed_event(db_session):
    events = [{
        "source": "TEST",
        "source_event_id": "EV-3"
        # Missing event_type, title, severity, confidence
    }]
    svc = IngestionService(db_session, MockAdapter(events))
    stats = svc.run_ingestion()
    
    assert stats["accepted"] == 0
    assert stats["rejected"] == 1
    assert db_session.query(GeopoliticalEvent).count() == 0

def test_unresolved_entity(db_session):
    events = [{
        "source": "TEST",
        "source_event_id": "EV-4",
        "event_type": "Random",
        "title": "Middle of nowhere",
        "severity": 0.1,
        "confidence": 0.9,
        "country_reference": "UNKNOWN"
    }]
    svc = IngestionService(db_session, MockAdapter(events))
    stats = svc.run_ingestion()
    
    assert stats["accepted"] == 1
    assert stats["resolved"] == 0
    assert stats["unresolved"] == 1
    assert stats["risk_scores_created"] == 0
    
    ev = db_session.query(GeopoliticalEvent).first()
    assert ev.affected_entity_id is None

def test_risk_calculation(db_session):
    events = [{
        "source": "TEST",
        "source_event_id": "EV-5",
        "event_type": "Naval",
        "title": "Hormuz severe attack",
        "severity": 0.9,
        "confidence": 0.9
    }]
    svc = IngestionService(db_session, MockAdapter(events))
    svc.run_ingestion()
    
    risk = db_session.query(RiskScore).first()
    # 0.9 * 0.9 = 0.81
    # Resolves to Hormuz -> * 1.2 = 0.972 -> 97.2 -> CRITICAL
    assert risk.entity_id == "CHK_HORMUZ"
    assert risk.score == 97.2
    assert risk.level.value == "CRITICAL"

def test_postgres_persistence_and_outbox(db_session):
    events = [{
        "source": "TEST",
        "source_event_id": "EV-6",
        "event_type": "Test",
        "title": "Test Title",
        "severity": 0.5,
        "confidence": 1.0,
        "country_reference": "IND"
    }]
    svc = IngestionService(db_session, MockAdapter(events))
    svc.run_ingestion()
    
    # 1 event, 1 risk score
    assert db_session.query(GeopoliticalEvent).count() == 1
    assert db_session.query(RiskScore).count() == 1
    
    # 2 outbox events
    outbox = db_session.query(OutboxEvent).all()
    assert len(outbox) == 2
    types = [o.aggregate_type for o in outbox]
    assert "GeopoliticalEvent" in types
    assert "RiskScore" in types
