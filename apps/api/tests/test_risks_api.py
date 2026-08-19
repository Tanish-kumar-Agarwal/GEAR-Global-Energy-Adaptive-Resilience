import pytest
from fastapi.testclient import TestClient
from main import app
from core.database import Base, engine, SessionLocal
from models.domain import RiskScore, RiskLevel
from datetime import datetime, timezone
import uuid

client = TestClient(app)

@pytest.fixture
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    yield db
    db.close()

def test_get_risk_evaluation_empty(db_session):
    # clear db
    db_session.query(RiskScore).delete()
    db_session.commit()
    
    response = client.get("/api/v1/risks/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert data["systemic_risk_score"] == 0.0
    assert data["active_critical_risks"] == 0

def test_get_risk_evaluation_with_data(db_session):
    db_session.query(RiskScore).delete()
    rs1 = RiskScore(id=uuid.uuid4(), entity_id="CHK_HORMUZ", score=90.0, level=RiskLevel.CRITICAL, timestamp=datetime.now(timezone.utc))
    rs2 = RiskScore(id=uuid.uuid4(), entity_id="CHK_MALACCA", score=40.0, level=RiskLevel.MEDIUM, timestamp=datetime.now(timezone.utc))
    db_session.add_all([rs1, rs2])
    db_session.commit()
    
    response = client.get("/api/v1/risks/evaluation")
    assert response.status_code == 200
    data = response.json()
    assert data["systemic_risk_score"] == 65.0
    assert data["active_critical_risks"] == 1
    assert data["active_high_risks"] == 0

def test_get_risk_trend(db_session):
    db_session.query(RiskScore).delete()
    rs = RiskScore(id=uuid.uuid4(), entity_id="CHK_HORMUZ", score=90.0, level=RiskLevel.CRITICAL, timestamp=datetime.now(timezone.utc))
    db_session.add(rs)
    db_session.commit()
    
    response = client.get("/api/v1/risks/trend?entity_id=CHK_HORMUZ")
    assert response.status_code == 200
    assert len(response.json()["data"]) == 1
    assert response.json()["data"][0]["score"] == 90.0
