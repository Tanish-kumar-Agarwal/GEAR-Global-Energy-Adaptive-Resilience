import pytest
from fastapi.testclient import TestClient
from main import app
from core.database import Base, engine, SessionLocal
from models.domain import StrategyScenario, JobStatus

client = TestClient(app)

def setup_module(module):
    Base.metadata.create_all(bind=engine)

def teardown_module(module):
    Base.metadata.drop_all(bind=engine)

def test_create_strategy_scenario():
    response = client.post(
        "/api/v1/strategy/scenarios",
        json={
            "name": "Test Diversification",
            "baseline_scenario_id": "test_base",
            "levers": [{"type": "supplier_diversification", "target_id": "SUP_X"}]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "strategy_id" in data
    assert data["status"] == "QUEUED"

    # Verify it exists in db
    db = SessionLocal()
    strat = db.query(StrategyScenario).filter(StrategyScenario.id == data["strategy_id"]).first()
    assert strat is not None
    assert strat.name == "Test Diversification"
    db.close()

def test_get_strategy_options():
    response = client.get("/api/v1/strategy/options")
    assert response.status_code == 200
    data = response.json()
    assert data["financial_optimization"] == "DATA_UNAVAILABLE"
