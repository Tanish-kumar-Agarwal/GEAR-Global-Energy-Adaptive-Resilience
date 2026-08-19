from graph.algorithms.blast_radius import calculate_blast_radius
from typing import Dict, Any

def generate_scenario_overlay(scenario_id: str, chokepoint_id: str, severity: float) -> Dict[str, Any]:
    """
    Generates a read-only scenario overlay graph based on the baseline graph.
    The baseline graph is never mutated. We perform a query against the baseline to see what
    is affected and return an 'overlay' that can be merged with baseline data in the frontend.
    """
    # 1. Get Blast Radius
    # Note: we treat the disruption at a chokepoint as the source
    blast_radius = calculate_blast_radius("Chokepoint", chokepoint_id)
    
    # 2. Build Overlay Structure
    # This structure can be appended to Job.result
    overlay = {
        "scenario_id": scenario_id,
        "disruption_source": {
            "entity_type": "Chokepoint",
            "entity_id": chokepoint_id,
            "applied_severity": severity
        },
        "blast_radius": blast_radius,
        "derived_states": {
            "capacity_multiplier": 1.0 - severity
        },
        "metadata": {
            "projection_version": "v1.0",
            "source": "Neo4j Baseline Graph"
        }
    }
    
    return overlay
