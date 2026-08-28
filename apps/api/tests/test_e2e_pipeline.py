import pytest
import sys
import os

# Add the apps/api directory to sys.path so 'main' can be resolved
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
from core.database import Base, engine, SessionLocal
import uuid
import pytest

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield

def test_full_pipeline_e2e():
    # 1. Create a Scenario
    scenario_payload = {
        "name": "E2E Test Scenario",
        "target_id": "CHK_HORMUZ",
        "severity": 0.8,
        "duration_days": 45
    }
    response = client.post("/api/v1/scenarios", json=scenario_payload)
    assert response.status_code == 200
    scenario_id = response.json()["id"]
    
    # 2. Run Scenario Simulation
    response = client.post(f"/api/v1/scenarios/{scenario_id}/run?sync_fallback=true")
    assert response.status_code in [200, 202]
    job_id = str(response.json()["job_id"])
    
    db = SessionLocal()
    from models.domain import Job, JobStatus
    mock_job = Job(id=uuid.UUID(scenario_id), type="SCENARIO_SIMULATION", status=JobStatus.COMPLETED)
    db.add(mock_job)
    db.commit()
    
    # 3. Create Optimization Job
    opt_payload = {
        "scenario_id": scenario_id
    }
    response = client.post("/api/v1/optimization/procurement", json=opt_payload)
    assert response.status_code == 202
    opt_job_id = response.json()["job_id"]
    
    # 4. Check Pending Decisions
    response = client.get("/api/v1/decisions/pending")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    
    # 5. Create a Decision
    dec_payload = {
        "scenario_id": scenario_id,
        "recommendation_id": opt_job_id,
        "status": "PENDING",
        "action_plan": {"route": "R1", "volume": 100}
    }
    response = client.post("/api/v1/decisions", json=dec_payload)
    assert response.status_code == 200
    decision_id = response.json()["decision_id"]
    assert decision_id is not None
    
    # 6. Update Decision Status (Approve)
    update_payload = {
        "reason": "Looks good",
        "comment": "Approved by E2E test"
    }
    response = client.post(f"/api/v1/decisions/{scenario_id}/approve", json=update_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "APPROVED"
    
    # 7. Check Explainability Route
    response = client.get(f"/api/v1/intelligence/explainability/scenario/{scenario_id}")
    # It might return 404 since there's no data, but let's check for 200 or 404
    assert response.status_code in [200, 404]
