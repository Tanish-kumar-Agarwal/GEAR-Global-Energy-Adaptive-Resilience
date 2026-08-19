import pytest
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from fastapi.testclient import TestClient
from main import app
from core.database import get_db, Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import uuid

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    from models import domain
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_full_orchestrator_flow():
    # 1. Create a Scenario
    scenario_res = client.post("/api/v1/scenarios", json={
        "name": "Orchestrator Test",
        "target_id": "TEST_ASSET",
        "severity": 0.8,
        "duration_days": 30
    })
    assert scenario_res.status_code == 200
    scenario_id = scenario_res.json()["id"]

    # 2. Trigger Simulation (Wait not needed for this test as we fake the job result in DB)
    run_res = client.post(f"/api/v1/scenarios/{scenario_id}/run")
    assert run_res.status_code == 202
    job_id = run_res.json()["job_id"]
    
    # 3. Inject Fake Simulation Job Data directly into the DB to test the Orchestrator mapping
    db = TestingSessionLocal()
    from models.domain import Job, JobStatus, DecisionAudit, Scenario
    scenario = db.query(Scenario).filter(Scenario.id == uuid.UUID(scenario_id)).first()
    scenario.job_id = uuid.UUID(job_id)
    
    job = db.query(Job).filter(Job.id == uuid.UUID(job_id)).first()
    job.status = JobStatus.COMPLETED
    job.result = {
        "impact": {"supply_gap": 150.5},
        "economic_impact": {"impact": {"total": "1.5B"}},
        "cascade": {"affected_routes": ["R1"], "affected_assets": ["A1"], "affected_countries": ["C1"]},
        "uncertainty": {"P10": {"supply_gap": 100}, "P50": {"supply_gap": 150}, "P90": {"supply_gap": 200}}
    }
    db.commit()

    # 4. Trigger Optimization
    opt_res = client.post("/api/v1/optimization/procurement", json={"scenario_id": job_id})
    assert opt_res.status_code == 202
    opt_job_id = opt_res.json()["job_id"]
    
    opt_job = db.query(Job).filter(Job.id == uuid.UUID(opt_job_id)).first()
    opt_job.status = JobStatus.COMPLETED
    opt_job.result = {
        "scenario_id": scenario_id,
        "allocations": [
            {"destination_id": "D1", "supplier_id": "S1", "route_id": "R2", "volume_allocated": 100}
        ],
        "objective": {"optimized_shortage": 50.5, "improvement": 100.0},
        "reserve_usage": {"total_drawdown": 0},
        "avoided_loss": "1.0B"
    }
    db.commit()

    # 5. Fetch Master Response Object
    master_res = client.get(f"/api/v1/response/{scenario_id}")
    assert master_res.status_code == 200
    master_data = master_res.json()
    
    print("MASTER STATUS:", master_data["status"])
    print("PROBLEM STATUS:", master_data["problem"]["status"])

    assert master_data["status"] == "SUCCESS"
    assert master_data["problem"]["target"] == "TEST_ASSET"
    assert master_data["impact"]["supply_gap"] == 150.5
    assert master_data["impact"]["economic_impact_total"] == "1.5B"
    assert master_data["options"][0]["option_type"] == "ROUTING"
    assert master_data["recommendation"]["expected_physical_impact"]["shortage"] == 50.5
    assert master_data["approval"]["status"] == "DRAFT"

    # 6. Create a Decision (Submit for Review)
    dec_res = client.post("/api/v1/decisions", json={
        "scenario_id": scenario_id,
        "recommendation_id": master_data["recommendation"]["recommendation_id"],
        "status": "PENDING",
        "action_plan": {"optimization": master_data["optimization"]}
    })
    assert dec_res.status_code == 200
    decision_id = dec_res.json()["decision_id"]

    # 7. Approve via Canonical API
    app_res = client.post(f"/api/v1/response/{decision_id}/approve")
    assert app_res.status_code == 200
    assert app_res.json()["new_status"] == "APPROVED"

    # 8. Check Audit Trail Immutability
    audit_res = client.get(f"/api/v1/response/{decision_id}/audit")
    assert audit_res.status_code == 200
    history = audit_res.json()["history"]
    assert len(history) == 2 # PENDING -> APPROVED

    db.close()

def test_data_unavailable_semantics():
    # Attempting to fetch response for missing scenario
    res = client.get("/api/v1/response/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "DATA_UNAVAILABLE"
    assert data["impact"]["supply_gap"] is None
    assert data["impact"]["economic_impact_total"] == "data_unavailable"
    assert data["recommendation"]["optimization_status"] == "DATA_UNAVAILABLE"
    assert len(data["options"]) == 0
