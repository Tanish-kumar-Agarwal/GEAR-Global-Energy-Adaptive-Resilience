from graph.neo4j_client import neo4j_client
from typing import Dict, Any

def calculate_blast_radius(entity_type: str, entity_id: str) -> Dict[str, Any]:
    """
    Calculates the downstream blast radius up to 3 hops from a given source node.
    This separates GRAPH REACHABILITY from ACTUAL SIMULATED IMPACT.
    """
    
    query = """
    MATCH (source {id: $entity_id})
    CALL apoc.path.subgraphAll(source, {
        relationshipFilter: "PASSES_THROUGH>|USES_ROUTE>|DESTINED_FOR>|LOCATED_IN>",
        minLevel: 1,
        maxLevel: 3
    })
    YIELD nodes, relationships
    RETURN 
        [n IN nodes WHERE n:Country | n.id] AS affected_countries,
        [n IN nodes WHERE n:EnergyAsset | n.id] AS affected_assets,
        [n IN nodes WHERE n:Route | n.id] AS affected_routes,
        [n IN nodes WHERE n:TradeFlow | n.id] AS affected_trade_flows
    """
    
    # Notice: APOC is standard in Neo4j. If it is not installed or available, we can fallback to standard CYPHER variable length paths.
    fallback_query = """
    MATCH p = (source {id: $entity_id})-[:PASSES_THROUGH|USES_ROUTE|DESTINED_FOR|LOCATED_IN*1..3]->(target)
    WITH collect(DISTINCT target) AS nodes
    RETURN 
        [n IN nodes WHERE 'Country' IN labels(n) | n.id] AS affected_countries,
        [n IN nodes WHERE 'EnergyAsset' IN labels(n) | n.id] AS affected_assets,
        [n IN nodes WHERE 'Route' IN labels(n) | n.id] AS affected_routes,
        [n IN nodes WHERE 'TradeFlow' IN labels(n) | n.id] AS affected_trade_flows
    """
    
    try:
        # We will use the fallback query to avoid APOC dependency for safety
        results = neo4j_client.execute_read(fallback_query, entity_id=entity_id)
        if results:
            return results[0]
        return {
            "affected_countries": [],
            "affected_assets": [],
            "affected_routes": [],
            "affected_trade_flows": []
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "affected_countries": [],
            "affected_assets": [],
            "affected_routes": [],
            "affected_trade_flows": []
        }
