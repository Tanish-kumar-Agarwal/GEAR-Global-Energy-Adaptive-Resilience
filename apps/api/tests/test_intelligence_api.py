import pytest
from fastapi.testclient import TestClient
from main import app
from core.database import Base, engine, SessionLocal
from models.domain import GeopoliticalEvent, RiskScore, RiskLevel
from datetime import datetime, timezone
import uuid

client = TestClient(app)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    yield db
    db.close()

def test_get_events(db_session):
    db_session.query(GeopoliticalEvent).delete()
    ev = GeopoliticalEvent(
        id=uuid.uuid4(),
        source_id="TEST_SOURCE",
        source_event_id="TEST_EV_1",
        type="Naval",
        title="Test Event",
        severity=0.8,
        confidence=0.9,
        timestamp=datetime.now(timezone.utc),
        ingestion_time=datetime.now(timezone.utc)
    )
    db_session.add(ev)
    db_session.commit()
    
    response = client.get("/api/v1/intelligence/events")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["data"][0]["title"] == "Test Event"
    assert data["data"][0]["type"] == "Naval"

def test_get_explainability_not_found(db_session):
    response = client.get(f"/api/v1/intelligence/explainability?risk_id={uuid.uuid4()}")
    assert response.status_code == 404

def test_get_explainability(db_session):
    db_session.query(GeopoliticalEvent).delete()
    db_session.query(RiskScore).delete()
    
    risk_id = uuid.uuid4()
    rs = RiskScore(id=risk_id, entity_id="CHK_HORMUZ", score=90.0, level=RiskLevel.CRITICAL, timestamp=datetime.now(timezone.utc))
    ev = GeopoliticalEvent(
        id=uuid.uuid4(),
        source_id="TEST_SOURCE",
        source_event_id="TEST_EV_2",
        type="Naval",
        title="Test Event Expl",
        severity=0.8,
        confidence=0.9,
        affected_entity_id="CHK_HORMUZ",
        timestamp=datetime.now(timezone.utc),
        ingestion_time=datetime.now(timezone.utc)
    )
    
    db_session.add_all([rs, ev])
    db_session.commit()
    
    response = client.get(f"/api/v1/intelligence/explainability?risk_id={risk_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] == 90.0
    assert len(data["factors"]) == 1
    assert data["factors"][0]["factor"] == "Event Severity & Confidence"
    assert len(data["evidence"]) == 1
    assert data["evidence"][0]["title"] == "Test Event Expl"
