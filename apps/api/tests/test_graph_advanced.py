import pytest
from unittest.mock import patch, MagicMock

# Mocks for tests
class MockNeo4jClient:
    def __init__(self):
        self.writes = []
        self.reads = []

    def execute_write(self, query, **kwargs):
        self.writes.append({"query": query, "params": kwargs})
        
    def execute_read(self, query, **kwargs):
        self.reads.append({"query": query, "params": kwargs})
        # Deterministic mock return for blast radius
        if "apoc.path.subgraphAll" in query or "1..3" in query:
            return [{"affected_countries": ["CN", "JP"], "affected_assets": ["PORT_1"], "affected_routes": ["RT_1"], "affected_trade_flows": ["TF_1"]}]
        # Deterministic mock for centrality
        if "NodeID" in query:
            return [{"NodeID": "CHK_1", "TotalExposedVolume": 100.0}, {"NodeID": "RT_1", "TotalExposedVolume": 50.0}]
        return []

mock_neo4j = MockNeo4jClient()

@pytest.fixture(autouse=True)
def patch_neo4j():
    with patch("graph.neo4j_client.neo4j_client", mock_neo4j):
        with patch("graph.algorithms.blast_radius.neo4j_client", mock_neo4j):
            with patch("graph.algorithms.centrality.neo4j_client", mock_neo4j):
                yield
                mock_neo4j.writes.clear()
                mock_neo4j.reads.clear()

def test_blast_radius_calculation():
    from graph.algorithms.blast_radius import calculate_blast_radius
    result = calculate_blast_radius("Chokepoint", "CHK_HORMUZ")
    
    assert "affected_countries" in result
    assert "affected_assets" in result
    assert "affected_routes" in result
    assert "affected_trade_flows" in result
    assert len(result["affected_countries"]) == 2
    assert result["affected_countries"][0] == "CN"

def test_centrality_calculation():
    from graph.algorithms.centrality import calculate_structural_criticality
    results = calculate_structural_criticality()
    
    assert len(results) > 0
    assert results[0]["NodeID"] == "CHK_1"
    assert results[0]["TotalExposedVolume"] == 100.0

def test_scenario_overlay_isolation():
    from graph.algorithms.scenario_overlay import generate_scenario_overlay
    
    overlay_a = generate_scenario_overlay("SCN_A", "CHK_1", 0.5)
    overlay_b = generate_scenario_overlay("SCN_B", "CHK_2", 0.8)
    
    # Assert scenario overlays are isolated and distinct
    assert overlay_a["scenario_id"] == "SCN_A"
    assert overlay_b["scenario_id"] == "SCN_B"
    assert overlay_a["disruption_source"]["entity_id"] == "CHK_1"
    assert overlay_b["disruption_source"]["entity_id"] == "CHK_2"
    
    # Assert baseline immutability (the generate function only performs reads)
    # writes should be exactly 0
    assert len(mock_neo4j.writes) == 0

def test_baseline_immutability():
    from graph.algorithms.scenario_overlay import generate_scenario_overlay
    
    # A core requirement: simulating a scenario MUST NOT mutate the baseline.
    initial_write_count = len(mock_neo4j.writes)
    
    generate_scenario_overlay("TEST_SCN", "CHK_HORMUZ", 0.9)
    
    final_write_count = len(mock_neo4j.writes)
    
    assert initial_write_count == final_write_count, "Scenario generation mutated the baseline graph!"
