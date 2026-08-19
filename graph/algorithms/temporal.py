from graph.neo4j_client import neo4j_client
from typing import Dict, Any, List

def get_active_events(start_time: str, end_time: str) -> List[Dict[str, Any]]:
    """
    Returns geopolitical events and risk scores active within a specific time window.
    Only entities that have an explicit 'event_time' or 'timestamp' property are evaluated.
    """
    
    query = """
    MATCH (e:GeopoliticalEvent)
    WHERE e.event_time >= $start_time AND e.event_time <= $end_time
    RETURN e.id AS id, e.type AS type, e.severity AS severity, e.event_time AS event_time
    ORDER BY e.event_time ASC
    """
    
    res = neo4j_client.execute_read(query, start_time=start_time, end_time=end_time)
    return res

def get_temporal_exposure(entity_type: str, entity_id: str, start_time: str, end_time: str) -> Dict[str, Any]:
    """
    Finds exposure for a specific entity driven strictly by events within a temporal window.
    """
    
    query = """
    MATCH (n {id: $entity_id})
    // For now we map any event targeting the country this entity belongs to
    // or targeting the entity directly.
    MATCH (e:GeopoliticalEvent)
    WHERE e.event_time >= $start_time AND e.event_time <= $end_time
    // Simplified generic temporal link for the demo: 
    // Event -> targets -> Entity (either direct or via Country)
    MATCH (e)-[:TARGETS|AFFECTS]->(target)
    WHERE target.id = n.id OR (n)-[:LOCATED_IN|ORIGINATES_FROM|DESTINED_FOR]->(target)
    
    RETURN DISTINCT e.id AS event_id, e.severity AS severity, e.event_time AS event_time, target.id AS affected_target
    ORDER BY e.event_time ASC
    """
    
    res = neo4j_client.execute_read(query, entity_id=entity_id, start_time=start_time, end_time=end_time)
    
    if not res:
        return {
            "status": "data_unavailable",
            "temporal_resolution": "point_in_time",
            "events": []
        }
        
    return {
        "status": "completed",
        "entity_id": entity_id,
        "temporal_resolution": "point_in_time",
        "events": res
    }
