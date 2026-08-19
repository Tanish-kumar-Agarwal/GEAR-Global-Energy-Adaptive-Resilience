from graph.neo4j_client import neo4j_client

def get_dependent_countries(chokepoint_id: str):
    query = """
    MATCH (c:Chokepoint {id: $chokepoint_id})<-[:PASSES_THROUGH]-(r:Route)<-[:USES_ROUTE]-(tf:TradeFlow)-[:DESTINED_FOR]->(dest:Country)
    RETURN DISTINCT dest.id AS Country, dest.name AS Name
    """
    return neo4j_client.execute_read(query, chokepoint_id=chokepoint_id)

def get_exposed_suppliers(chokepoint_id: str):
    query = """
    MATCH (c:Chokepoint {id: $chokepoint_id})<-[:PASSES_THROUGH]-(r:Route)<-[:USES_ROUTE]-(tf:TradeFlow)<-[:EXPORTS_VIA]-(s:Supplier)
    RETURN DISTINCT s.id AS Supplier, s.name AS Name
    """
    return neo4j_client.execute_read(query, chokepoint_id=chokepoint_id)

def get_routes_through_chokepoint(chokepoint_id: str):
    query = """
    MATCH (r:Route)-[:PASSES_THROUGH]->(c:Chokepoint {id: $chokepoint_id})
    RETURN r.id AS Route, r.name AS Name
    """
    return neo4j_client.execute_read(query, chokepoint_id=chokepoint_id)

def get_downstream_assets(chokepoint_id: str):
    query = """
    MATCH (c:Chokepoint {id: $chokepoint_id})<-[:PASSES_THROUGH]-(r:Route)<-[:USES_ROUTE]-(tf:TradeFlow)-[:DESTINED_FOR]->(dest:Country)
    MATCH (asset:EnergyAsset)-[:LOCATED_IN]->(dest)
    RETURN DISTINCT asset.id AS Asset, asset.name AS Name, asset.type AS Type
    """
    return neo4j_client.execute_read(query, chokepoint_id=chokepoint_id)

def get_geopolitical_events_affecting_node(node_id: str):
    query = """
    MATCH (e:GeopoliticalEvent)-[:AFFECTS]->(n {id: $node_id})
    RETURN e.id AS EventID, e.title AS Title, e.severity AS Severity, e.event_time AS Time
    """
    return neo4j_client.execute_read(query, node_id=node_id)

def get_risk_scores_for_node(node_id: str):
    query = """
    MATCH (r:RiskScore)-[:ASSESSES]->(n {id: $node_id})
    RETURN r.score AS Score, r.level AS Level
    """
    return neo4j_client.execute_read(query, node_id=node_id)
