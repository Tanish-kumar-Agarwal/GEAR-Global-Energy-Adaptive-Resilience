import pytest
from unittest.mock import patch

# Mock neo4j responses for predictability
class MockNeo4jClient:
    def execute_read(self, query, **kwargs):
        if "events" in query or "GeopoliticalEvent" in query:
            return [
                {"id": "EVT_1", "type": "CONFLICT", "severity": 0.8, "event_time": "2024-01-10T10:00:00Z", "affected_target": "CN"},
                {"id": "EVT_2", "type": "PIRACY", "severity": 0.5, "event_time": "2024-02-15T10:00:00Z", "affected_target": "CN"}
            ]
        if "max_volume" in query:
            return [{"max_volume": 1000.0, "max_deps": 50}]
        if "exposed_volume" in query:
            return [{"exposed_volume": 500.0, "dependency_count": 25}]
        return []

mock_neo4j = MockNeo4jClient()

@pytest.fixture(autouse=True)
def patch_neo4j():
    with patch("graph.algorithms.systemic_risk.neo4j_client", mock_neo4j):
        with patch("graph.algorithms.temporal.neo4j_client", mock_neo4j):
            with patch("graph.algorithms.systemic_risk.calculate_blast_radius", return_value={"affected_countries": ["CN", "JP", "IN"], "affected_assets": ["A1", "A2"]}):
                yield

def test_systemic_risk_calculation():
    from graph.algorithms.systemic_risk import calculate_systemic_risk
    
    result = calculate_systemic_risk("Chokepoint", "CHK_HORMUZ")
    
    assert result["status"] == "completed"
    assert "systemic_risk_score" in result
    assert result["systemic_risk_score"] <= 100.0
    
    # 500/1000 = 0.5 * 0.5 = 0.25 (Volume)
    # 25/50 = 0.5 * 0.2 = 0.10 (Deps)
    # 5/200 = 0.025 * 0.3 = 0.0075 (Blast)
    # Total ~ 0.3575 * 100 = 35.8
    assert result["systemic_risk_score"] == 35.8
    assert result["risk_level"] == "MEDIUM"
    assert result["factors"]["dependency_count"] == 25
    assert result["factors"]["blast_radius_size"] == 5

def test_temporal_events():
    from graph.algorithms.temporal import get_active_events
    
    events = get_active_events("2024-01-01T00:00:00Z", "2024-12-31T23:59:59Z")
    assert len(events) == 2
    assert events[0]["id"] == "EVT_1"
    
def test_temporal_exposure():
    from graph.algorithms.temporal import get_temporal_exposure
    
    res = get_temporal_exposure("Country", "CN", "2024-01-01", "2024-12-31")
    assert res["status"] == "completed"
    assert res["temporal_resolution"] == "point_in_time"
    assert len(res["events"]) == 2