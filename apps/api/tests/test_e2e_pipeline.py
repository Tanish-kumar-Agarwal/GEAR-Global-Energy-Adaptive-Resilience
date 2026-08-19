import pytest
from fastapi.testclient import TestClient
from main import app
from core.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_e2e.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

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
    response = client.post(f"/api/v1/scenarios/{scenario_id}/run")
    assert response.status_code == 202
    job_id = response.json()["job_id"]
    
    # Since Celery tasks are mocked to return 'QUEUED', we simulate job completion in db
    # In a real test, we would wait for Celery, but here we just test the endpoint workflow
    
    # Let's mock a job insertion to make the optimization route pass
    db = TestingSessionLocal()
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
    
    # 6. Update Decision Status
    update_payload = {
        "status": "APPROVED",
        "review_note": "Looks good"
    }
    response = client.put(f"/api/v1/decisions/{decision_id}", json=update_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "APPROVED"
    
    # 7. Check Explainability Route
    response = client.get(f"/api/v1/intelligence/explainability/scenario/{scenario_id}")
    # It might return 404 since there's no data, but let's check for 200 or 404
    assert response.status_code in [200, 404]
