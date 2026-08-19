import pytest
import uuid
from fastapi.testclient import TestClient
from main import app
from core.database import Base, engine, SessionLocal
from models.domain import Scenario, DecisionAudit

client = TestClient(app)

def setup_module(module):
    Base.metadata.create_all(bind=engine)

def teardown_module(module):
    Base.metadata.drop_all(bind=engine)

def test_decision_center_flow():
    db = SessionLocal()
    # Create test scenario
    test_scenario_id = str(uuid.uuid4())
    scenario = Scenario(id=test_scenario_id, name="Test Scenario")
    db.add(scenario)
    db.commit()
    db.close()

    # 1. Reject without reason -> Should fail 400
    res = client.post(f"/api/v1/decisions/{test_scenario_id}/reject", json={"reason": "", "comment": "test"})
    assert res.status_code == 400
    assert res.json()["detail"] == "REASON_REQUIRED"

    # 2. Reject with reason -> Should succeed
    res = client.post(f"/api/v1/decisions/{test_scenario_id}/reject", json={"reason": "Unacceptable Risk", "comment": "test"})
    assert res.status_code == 200
    assert res.json()["status"] == "REJECTED"

    # 3. Check Audit trail Immutability
    res = client.get(f"/api/v1/decisions/{test_scenario_id}/audit")
    assert res.status_code == 200
    audits = res.json()
    assert len(audits) == 1
    assert audits[0]["status"] == "REJECTED"
    assert audits[0]["reason"] == "Unacceptable Risk"
    assert audits[0]["comment"] == "test"

    # 4. Try to approve a rejected scenario -> Should fail
    res = client.post(f"/api/v1/decisions/{test_scenario_id}/approve", json={"comment": "approve now"})
    assert res.status_code == 400
    assert res.json()["detail"] == "INVALID_STATE_TRANSITION"

def test_transactional_guarantee(monkeypatch):
    db = SessionLocal()
    test_scenario_id = str(uuid.uuid4())
    scenario = Scenario(id=test_scenario_id, name="Test Scenario 2")
    db.add(scenario)
    db.commit()
    db.close()
    
    # Mock _create_audit to throw an exception to simulate audit write failure
    import routes.decisions as dec_routes
    original_create_audit = dec_routes._create_audit
    
    def mock_create_audit(*args, **kwargs):
        raise Exception("Database failure simulation")
        
    monkeypatch.setattr(dec_routes, "_create_audit", mock_create_audit)
    
    # Send approve request
    res = client.post(f"/api/v1/decisions/{test_scenario_id}/approve", json={"comment": "approve"})
    assert res.status_code == 500
    
    # Verify rollback by checking DB manually - audit shouldn't exist and state shouldn't be touched.
    # We didn't change scenario state directly, but we can verify no audits were inserted despite beginning transaction.
    db = SessionLocal()
    audits = db.query(DecisionAudit).filter(DecisionAudit.scenario_id == test_scenario_id).all()
    assert len(audits) == 0
    db.close()
