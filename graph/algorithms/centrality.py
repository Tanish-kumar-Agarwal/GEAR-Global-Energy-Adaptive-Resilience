from graph.neo4j_client import neo4j_client
from typing import Dict, Any, List

def calculate_structural_criticality() -> List[Dict[str, Any]]:
    """
    Calculates the structural criticality of Chokepoints and Routes based on the total 
    trade volume that passes through them.
    This provides a deterministic 'Critical Nodes' list.
    """
    
    # 1. Chokepoint Criticality
    query_chokepoints = """
    MATCH (chk:Chokepoint)<-[:PASSES_THROUGH]-(r:Route)<-[:USES_ROUTE]-(tf:TradeFlow)
    RETURN 
        chk.id AS NodeID, 
        chk.name AS NodeName, 
        'Chokepoint' AS NodeType,
        sum(tf.volume) AS TotalExposedVolume,
        count(DISTINCT tf) AS DependencyCount
    ORDER BY TotalExposedVolume DESC
    """
    chokepoints = neo4j_client.execute_read(query_chokepoints)
    
    # 2. Route Criticality
    query_routes = """
    MATCH (r:Route)<-[:USES_ROUTE]-(tf:TradeFlow)
    RETURN 
        r.id AS NodeID, 
        r.name AS NodeName, 
        'Route' AS NodeType,
        sum(tf.volume) AS TotalExposedVolume,
        count(DISTINCT tf) AS DependencyCount
    ORDER BY TotalExposedVolume DESC
    """
    routes = neo4j_client.execute_read(query_routes)
    
    # Merge and sort
    results = chokepoints + routes
    results.sort(key=lambda x: x.get('TotalExposedVolume', 0), reverse=True)
    
    return results
