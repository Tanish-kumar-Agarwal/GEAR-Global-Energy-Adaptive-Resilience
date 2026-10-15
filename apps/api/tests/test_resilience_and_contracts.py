import time
import uuid
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from main import app
from core.database import Base, engine, SessionLocal
from core.security import create_access_token, DemoPrincipal
from models.domain import Scenario, TradeFlow, Route, EnergyAsset, User, Role
from simulation.monte_carlo.runner import run_monte_carlo
from simulation.cascade.engine import AdvancedCascadeEngine

client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Seed admin user
    if not db.query(User).filter(User.username == "admin").first():
        admin_user = User(
            username="admin",
            role=Role.ADMIN,
            hashed_password="hashed_placeholder",
            is_active=True
        )
        db.add(admin_user)
        db.commit()

    # Seed trade flows for deterministic calculations
    if not db.query(TradeFlow).first():
        tf1 = TradeFlow(
            id=uuid.uuid4(),
            supplier_id="SUP_SAU",
            destination_country_id="IND",
            commodity_id="COMM_CRUDE",
            route_id="RT_HORMUZ_1",
            volume=5.0
        )
        tf2 = TradeFlow(
            id=uuid.uuid4(),
            supplier_id="SUP_IRQ",
            destination_country_id="IND",
            commodity_id="COMM_CRUDE",
            route_id="RT_HORMUZ_1",
            volume=3.0
        )
        db.add_all([tf1, tf2])
        db.commit()
    db.close()
    yield

def test_scenario_does_not_hang_when_neo4j_unavailable():
    """
    Critical Resilience Test:
    Ensures that when Neo4j is completely unavailable, scenario simulation
    completes in < 3.0 seconds, does not hang, and returns a valid degraded structure.
    """
    db = SessionLocal()
    try:
        engine_inst = AdvancedCascadeEngine(db)
        
        # Simulate Neo4j raising ConnectionError (offline / unreachable)
        with patch("simulation.cascade.engine.neo4j_client.execute_read", side_effect=ConnectionError("Neo4j connection refused")):
            start_time = time.perf_counter()
            result = engine_inst.simulate("CHK_HORMUZ", severity=0.8, duration_days=30)
            elapsed = time.perf_counter() - start_time
            
            # 1. Bounded execution guarantee
            assert elapsed < 3.0, f"Execution took too long: {elapsed:.2f}s (must be < 3.0s)"
            
            # 2. Controlled degraded result
            assert result["status"] == "completed"
            assert result["graph_status"] == "GRAPH_DEGRADED"
            assert result["provenance"] == "GRAPH_DEGRADED"
            assert result["impact"]["supply_gap"] > 0
            assert "IND" in result["cascade"]["affected_countries"]
    finally:
        db.close()


def test_auth_boundary_enforces_demo_mode():
    """
    Verifies that unauthenticated requests are rejected with 401 when DEMO_MODE=false,
    and accepted with DemoPrincipal when DEMO_MODE=true.
    """
    with patch("graph.algorithms.centrality.calculate_structural_criticality", return_value=[]):
        # 1. When DEMO_MODE=false and no token: must return 401
        with patch("core.security.is_demo_mode", return_value=False):
            res = client.get("/api/v1/graph/critical-nodes")
            assert res.status_code == 401, f"Expected 401 Unauthorized but got {res.status_code}"
            assert "Not authenticated" in res.json().get("detail", "")

        # 2. When valid Bearer JWT is passed: must succeed even with DEMO_MODE=false
        token = create_access_token(data={"sub": "admin", "role": "ADMIN"})
        with patch("core.security.is_demo_mode", return_value=False):
            res = client.get(
                "/api/v1/graph/critical-nodes",
                headers={"Authorization": f"Bearer {token}"}
            )
            assert res.status_code == 200

        # 3. When DEMO_MODE=true and no token: returns DemoPrincipal successfully
        with patch("core.security.is_demo_mode", return_value=True):
            res = client.get("/api/v1/graph/critical-nodes")
            assert res.status_code == 200


def test_canonical_scenario_contract_schema():
    """
    Verifies that Monte Carlo simulation produces the exact canonical contract schema.
    """
    # Mock Neo4j to return downstream flows
    mock_flows = [{
        "target_id": "CHK_HORMUZ",
        "affected_trade_flows": ["tf-1", "tf-2"],
        "affected_countries": ["IND"]
    }]
    with patch("simulation.cascade.engine.neo4j_client.execute_read", return_value=mock_flows):
        mc_result = run_monte_carlo("CHK_HORMUZ", base_severity=0.5, duration_days=30, iterations=20, seed=42)
        
        # Verify Canonical Keys
        assert "status" in mc_result
        assert "uncertainty" in mc_result
        assert "cascade" in mc_result
        assert "impact" in mc_result
        assert "resilience" in mc_result
        assert "provenance" in mc_result
        
        # Verify Uncertainty Percentiles Contract
        uncertainty = mc_result["uncertainty"]
        assert "confidence" in uncertainty
        assert "percentiles" in uncertainty
        assert "p10" in uncertainty["percentiles"]
        assert "p50" in uncertainty["percentiles"]
        assert "p90" in uncertainty["percentiles"]
        assert uncertainty["percentiles"]["p10"] <= uncertainty["percentiles"]["p50"] <= uncertainty["percentiles"]["p90"]
        # Direct lowercase fields
        assert "p10" in uncertainty
        assert "p50" in uncertainty
        assert "p90" in uncertainty
        assert "P10" not in uncertainty
        assert "P50" not in uncertainty
        assert "P90" not in uncertainty
        assert "sample_count" in uncertainty
        assert "seed" in uncertainty
        assert uncertainty["p10"] <= uncertainty["p50"] <= uncertainty["p90"]

def test_canonical_allocations_contract():
    """
    Verifies that optimization produces canonical allocation schema with route_flows and reserve_drawdowns.
    """
    from optimization.procurement import optimize_procurement
    routes = [{"id": "RT_A", "capacity": 10.0, "destination_id": "IND", "supplier_id": "SUP_1"}]
    reserves = [{"id": "STR_1", "capacity": 5.0, "country_id": "IND"}]
    destinations = [{"id": "IND", "demand": 8.0}]
    
    result = optimize_procurement(routes, reserves, destinations, duration_days=30)
    assert result["status"] == "completed"
    assert "allocation" in result
    assert "route_flows" in result["allocation"]
    assert "reserve_drawdowns" in result["allocation"]
    assert isinstance(result["allocation"]["route_flows"], dict)
    assert isinstance(result["allocation"]["reserve_drawdowns"], dict)
