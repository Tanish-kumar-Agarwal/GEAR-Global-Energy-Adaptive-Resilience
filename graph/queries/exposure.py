from graph.neo4j_client import neo4j_client
from typing import Dict, Any, List

def get_upstream_exposure(entity_type: str, entity_id: str) -> List[Dict[str, Any]]:
    """
    Returns the upstream dependency chain for a given entity.
    """
    if entity_type == "Country":
        query = """
        MATCH (c:Country {id: $entity_id})<-[:DESTINED_FOR]-(tf:TradeFlow)
        OPTIONAL MATCH (tf)<-[:EXPORTS_VIA]-(s:Supplier)
        OPTIONAL MATCH (tf)-[:USES_ROUTE]->(r:Route)
        OPTIONAL MATCH (tf)-[:INVOLVES_COMMODITY]->(com:Commodity)
        RETURN 
            tf.id AS TradeFlow, 
            tf.volume AS Volume,
            s.id AS Supplier,
            s.name AS SupplierName,
            r.id AS Route,
            com.id AS Commodity
        """
    elif entity_type == "EnergyAsset":
        query = """
        MATCH (a:EnergyAsset {id: $entity_id})-[:LOCATED_IN]->(c:Country)
        MATCH (c)<-[:DESTINED_FOR]-(tf:TradeFlow)
        OPTIONAL MATCH (tf)<-[:EXPORTS_VIA]-(s:Supplier)
        OPTIONAL MATCH (tf)-[:INVOLVES_COMMODITY]->(com:Commodity)
        RETURN 
            tf.id AS TradeFlow, 
            s.id AS Supplier, 
            com.id AS Commodity
        """
    else:
        return []
    
    return neo4j_client.execute_read(query, entity_id=entity_id)

def get_downstream_exposure(entity_type: str, entity_id: str) -> List[Dict[str, Any]]:
    """
    Returns the downstream dependency chain for a given entity.
    """
    if entity_type == "Supplier":
        query = """
        MATCH (s:Supplier {id: $entity_id})-[:EXPORTS_VIA]->(tf:TradeFlow)-[:DESTINED_FOR]->(c:Country)
        OPTIONAL MATCH (tf)-[:INVOLVES_COMMODITY]->(com:Commodity)
        OPTIONAL MATCH (tf)-[:USES_ROUTE]->(r:Route)
        RETURN
            tf.id AS TradeFlow,
            tf.volume AS Volume,
            c.id AS Country,
            c.name AS CountryName,
            r.id AS Route,
            com.id AS Commodity
        """
    elif entity_type == "Chokepoint":
        query = """
        MATCH (chk:Chokepoint {id: $entity_id})<-[:PASSES_THROUGH]-(r:Route)<-[:USES_ROUTE]-(tf:TradeFlow)-[:DESTINED_FOR]->(c:Country)
        OPTIONAL MATCH (tf)<-[:EXPORTS_VIA]-(s:Supplier)
        OPTIONAL MATCH (tf)-[:INVOLVES_COMMODITY]->(com:Commodity)
        RETURN
            c.id AS Country,
            c.name AS CountryName,
            tf.id AS TradeFlow,
            tf.volume AS Volume,
            s.id AS Supplier,
            com.id AS Commodity
        """
    elif entity_type == "Commodity":
        query = """
        MATCH (com:Commodity {id: $entity_id})<-[:INVOLVES_COMMODITY]-(tf:TradeFlow)-[:DESTINED_FOR]->(c:Country)
        RETURN DISTINCT c.id AS Country, c.name AS CountryName, sum(tf.volume) as TotalVolume
        """
    else:
        return []
        
    return neo4j_client.execute_read(query, entity_id=entity_id)

def get_supplier_dependency(supplier_id: str) -> Dict[str, Any]:
    """
    Aggregates a supplier's dependencies.
    """
    query = """
    MATCH (s:Supplier {id: $supplier_id})-[:EXPORTS_VIA]->(tf:TradeFlow)
    MATCH (tf)-[:DESTINED_FOR]->(c:Country)
    OPTIONAL MATCH (tf)-[:INVOLVES_COMMODITY]->(com:Commodity)
    RETURN 
        collect(DISTINCT c.id) AS countries_served,
        collect(DISTINCT com.id) AS commodities_supplied,
        sum(tf.volume) AS total_volume
    """
    res = neo4j_client.execute_read(query, supplier_id=supplier_id)
    return res[0] if res else {}
