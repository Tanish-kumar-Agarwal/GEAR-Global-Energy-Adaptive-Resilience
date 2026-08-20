import pytest
from unittest.mock import MagicMock
from schemas.explainability import ScenarioExplainabilityResponse
from services.explainability_service import ExplainabilityService

def test_explainability_missing_job():
    db = MagicMock()
    db.query().filter().first.return_value = None
    
    svc = ExplainabilityService(db)
    res = svc.generate_scenario_explainability("00000000-0000-0000-0000-000000000000")
    assert res is None

def test_explainability_valid_generation():
    db = MagicMock()
    
    # Mocking Job
    class MockJob:
        id = "11111111-1111-1111-1111-111111111111"
        result = {
            "cascade": {"initial_disruption": {"target": "CHK_HORMUZ"}},
            "impact": {"supply_gap": 10.0},
            "economic_impact": {"impact": {"total": 500}},
            "resilience": {},
            "uncertainty": {"sample_count": 50}
        }
    
    # Mocking DecisionAudit
    class MockAudit:
        scenario_id = "11111111-1111-1111-1111-111111111111"
        action_plan = {
            "optimization": {
                "status": "completed",
                "strategy_id": "STRAT1",
                "objective": {"optimized_shortage": 2.0, "improvement": 8.0},
                "avoided_loss": 300,
                "economic_impact": {"impact": {"total": 200}},
                "resilience": {"diversification": {"utilized_route_count": 2}}
            }
        }
        
    def mock_query_first(*args, **kwargs):
        return MockAudit()
        
    db.query().filter().first.return_value = MockJob()
    db.query().filter().order_by().first.side_effect = lambda: MockAudit()
    
    svc = ExplainabilityService(db)
    res = svc.generate_scenario_explainability("11111111-1111-1111-1111-111111111111")
    
    assert res is not None
    assert isinstance(res, ScenarioExplainabilityResponse)
    
    # Check recommendation
    assert res.recommendation.status == "available"
    assert res.recommendation.strategy_id == "STRAT1"
    
    # Check expected impact delta
    assert res.expected_impact.baseline["shortage"] == 10.0
    assert res.expected_impact.recommended["shortage"] == 2.0
    assert res.expected_impact.difference["avoided_economic_loss"] == 300
    
    # Check Drivers
    assert len(res.primary_drivers) > 0
    assert "CHK_HORMUZ" in res.primary_drivers[0]
    
    # Check Evidence mapping
    assert len(res.evidence) == 2
    assert res.evidence[0].role == "scenario_target"
    
    # Check No LLM calculation / Assumptions
    assert len(res.assumptions) == 2
    
    # Check Statistical confidence mapping
    assert res.confidence.level == "statistical"

def test_explainability_missing_optimization():
    db = MagicMock()
    
    class MockJob:
        id = "11111111-1111-1111-1111-111111111111"
        result = {
            "cascade": {"initial_disruption": {"target": "CHK_HORMUZ"}},
            "impact": {"supply_gap": 10.0},
            "economic_impact": {"impact": {"total": 500}},
            "resilience": {},
            "uncertainty": {"sample_count": 0}
        }
    
    class MockAuditIncomplete:
        scenario_id = "11111111-1111-1111-1111-111111111111"
        action_plan = {
            "optimization": {
                "status": "infeasible"
            }
        }

    db.query().filter().first.return_value = MockJob()
    db.query().filter().order_by().first.side_effect = lambda: MockAuditIncomplete()
    
    svc = ExplainabilityService(db)
    res = svc.generate_scenario_explainability("11111111-1111-1111-1111-111111111111")
    
    assert res.recommendation.status == "data_unavailable"
    assert res.expected_impact.recommended["shortage"] == "data_unavailable"
    assert res.confidence.level == "deterministic"
