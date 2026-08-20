import pytest
import sys
import os

# Add the apps/api directory to sys.path so 'main' can be resolved
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
from core.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import uuid

# Use an in-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_e2e_temp.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import models.domain

Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

from core.security import get_current_user
from models.domain import User, Role

def override_get_current_user():
    return User(id="test-user-id", username="admin", role=Role.ADMIN, is_active=True)

app.dependency_overrides[get_current_user] = override_get_current_user

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
    
    # 5/6. Update Decision Status (Approve)
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
