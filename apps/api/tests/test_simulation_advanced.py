import pytest
from unittest.mock import patch
import numpy as np

# Mocking DB and Neo4j for isolated testing of the algorithms
class MockAsset:
    def __init__(self, asset_id, country_id, capacity):
        self.id = asset_id
        self.country_id = country_id
        self.capacity = capacity
        self.type = "STORAGE"

class MockTradeFlow:
    def __init__(self, flow_id, dest, vol):
        self.id = flow_id
        self.destination_country_id = dest
        self.volume = vol

class MockDB:
    def __init__(self):
        self.flows = [
            MockTradeFlow("F1", "IND", 10.0),
            MockTradeFlow("F2", "JPN", 5.0)
        ]
        self.assets = [
            MockAsset("A1", "IND", 100.0) # 100 capacity storage in IND
        ]
        
    def query(self, model):
        class QueryProxy:
            def __init__(self, items):
                self.items = items
            def filter(self, *args, **kwargs):
                return self
            def all(self):
                return self.items
                
        if model.__name__ == "TradeFlow":
            return QueryProxy(self.flows)
        elif model.__name__ == "EnergyAsset":
            return QueryProxy(self.assets)
        return QueryProxy([])

class MockNeo4j:
    def execute_read(self, query, **kwargs):
        if "affected_trade_flows" in query:
            return [{"affected_trade_flows": ["F1"], "affected_countries": ["IND"]}]
        if "affected_suppliers" in query:
            return [{"affected_suppliers": ["SUP1"], "affected_routes": ["RT1"]}]
        return []

mock_neo4j = MockNeo4j()

@pytest.fixture(autouse=True)
def patch_neo4j():
    with patch("simulation.cascade.engine.neo4j_client", mock_neo4j):
        yield

def test_deterministic_cascade():
    from simulation.cascade.engine import AdvancedCascadeEngine
    db = MockDB()
    engine = AdvancedCascadeEngine(db)
    
    # Severity 0.5 (50% reduction), duration 30 days
    res = engine.simulate("CHK_HORMUZ", 0.5, 30)
    
    assert res["status"] == "completed"
    
    # Baseline flow to IND is 10. Effective should be 5 (50% reduced).
    # Gap is 5. 
    # IND storage capacity is 100. Depletion days = 100 / 5 = 20 days.
    
    impact = res["impact"]
    assert impact["baseline_supply"] == 10.0
    assert impact["available_supply"] == 5.0
    assert impact["supply_gap"] == 5.0
    
    depletion = impact["storage_depletion"]
    assert "A1" in depletion
    assert depletion["A1"]["days_remaining"] == 20.0
    assert depletion["A1"]["depleted"] == True # Because 20 <= 30
    
    resilience = res["resilience"]
    assert resilience["time_to_impact"] == 20.0
    assert resilience["supply_resilience"] == 0.5
    assert resilience["reserve_resilience"] == 20.0

def test_monte_carlo_statistics():
    from simulation.monte_carlo.runner import run_monte_carlo
    
    # Mock engine so we can control outputs for stats test
    # We don't need real engine logic, we just want to test percentile math
    # But wait, run_monte_carlo creates AdvancedCascadeEngine natively.
    # We will just patch AdvancedCascadeEngine.simulate to return a variable gap
    
    gaps = [float(i) for i in range(101)] # 0 to 100
    
    class FakeEngine:
        def __init__(self, db):
            self.call_count = 0
            
        def simulate(self, target, sev, dur):
            val = gaps[min(self.call_count, 100)]
            self.call_count += 1
            return {
                "impact": {"supply_gap": val},
                "cascade": {}, "resilience": {}, "uncertainty": {}
            }
            
    with patch("simulation.monte_carlo.runner.AdvancedCascadeEngine", return_value=FakeEngine(None)):
        with patch("simulation.monte_carlo.runner.SessionLocal"):
            res = run_monte_carlo("CHK_HORMUZ", 0.5, iterations=100)
            
            # Percentiles on [1, 2, ..., 100]
            # P10 ~ 10, P50 ~ 50, P90 ~ 90
            unc = res["uncertainty"]
            assert unc["p10"] <= unc["p50"] <= unc["p90"]
            assert unc["confidence"] == "probabilistic"
            assert unc["seed"] == 42
            assert unc["sample_count"] == 100
