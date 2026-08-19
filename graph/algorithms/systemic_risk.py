from graph.neo4j_client import neo4j_client
from graph.algorithms.blast_radius import calculate_blast_radius
from typing import Dict, Any

def calculate_systemic_risk(entity_type: str, entity_id: str) -> Dict[str, Any]:
    """
    Calculates a deterministic structural Systemic Risk score (0-100) based on graph topology.
    It derives its score dynamically by querying maximum bounds from the current graph to normalize,
    then combines volume, dependency count, and blast radius.
    """
    
    # 1. Gather raw factors for the specific entity
    # (A) Centrality / Exposure (Trade Volume + Dependency Count)
    query_entity = """
    MATCH (n {id: $entity_id})
    OPTIONAL MATCH (n)<-[:PASSES_THROUGH|USES_ROUTE]-(r:Route)<-[:USES_ROUTE]-(tf:TradeFlow)
    // Fallback if entity is Supplier or Country
    OPTIONAL MATCH (n)-[:EXPORTS_VIA]->(tf2:TradeFlow)
    OPTIONAL MATCH (n)<-[:DESTINED_FOR]-(tf3:TradeFlow)
    
    WITH 
        coalesce(tf, tf2, tf3) as flows
    RETURN 
        sum(flows.volume) AS exposed_volume,
        count(DISTINCT flows) AS dependency_count
    """
    
    entity_res = neo4j_client.execute_read(query_entity, entity_id=entity_id)
    if not entity_res:
        return {"status": "data_unavailable", "reason": "Entity not found in graph"}
        
    exposed_volume = entity_res[0].get("exposed_volume", 0) or 0
    dependency_count = entity_res[0].get("dependency_count", 0) or 0
    
    # (B) Blast Radius Size
    blast = calculate_blast_radius(entity_type, entity_id)
    if blast.get("status") == "error":
        return {"status": "data_unavailable", "reason": "Blast radius failed"}
        
    affected_countries = len(blast.get("affected_countries", []))
    affected_assets = len(blast.get("affected_assets", []))
    affected_total = affected_countries + affected_assets

    # 2. Gather graph-wide maximums for normalization to ensure 0-100 bound
    query_max = """
    MATCH (tf:TradeFlow)
    RETURN 
        sum(tf.volume) AS max_volume,
        count(tf) AS max_deps
    """
    max_res = neo4j_client.execute_read(query_max)
    max_volume = max_res[0].get("max_volume", 1) or 1
    max_deps = max_res[0].get("max_deps", 1) or 1
    
    # Hardcoded max downstream for MVP structural scaling (e.g., 200 countries/assets)
    # Ideally, we'd query MATCH (c:Country), (a:EnergyAsset) RETURN count(c) + count(a)
    max_affected = 200 
    
    # 3. Calculate Normalized Components
    norm_volume = min(1.0, exposed_volume / max_volume)
    norm_deps = min(1.0, dependency_count / max_deps)
    norm_blast = min(1.0, affected_total / max_affected)
    
    # 4. Formula Calculation
    # Weights: Volume = 50%, Blast Radius = 30%, Dependencies = 20%
    score_raw = (norm_volume * 0.5) + (norm_blast * 0.3) + (norm_deps * 0.2)
    final_score = round(min(100.0, score_raw * 100), 1)
    
    # 5. Determine Level
    if final_score < 25:
        level = "LOW"
    elif final_score < 50:
        level = "MEDIUM"
    elif final_score < 75:
        level = "HIGH"
    else:
        level = "CRITICAL"

    return {
        "status": "completed",
        "entity_id": entity_id,
        "entity_type": entity_type,
        "systemic_risk_score": final_score,
        "risk_level": level,
        "factors": {
            "exposed_volume": round(exposed_volume, 2),
            "dependency_count": dependency_count,
            "blast_radius_size": affected_total,
            "affected_countries": affected_countries,
            "affected_assets": affected_assets
        },
        "methodology": "SystemicRisk = (NormalizedVolume*0.5 + NormalizedBlastRadius*0.3 + NormalizedDeps*0.2) * 100",
        "confidence": "structural"
    }
