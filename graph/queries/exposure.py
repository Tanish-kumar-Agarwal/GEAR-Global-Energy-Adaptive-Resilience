from graph.neo4j_client import neo4j_client

def get_downstream_exposure(chokepoint_id: str):
    """
    Returns downstream assets exposed if a chokepoint is disrupted.
    Query: Find routes passing through chokepoint -> trades on route -> destination countries
    """
    query = """
    MATCH (r:Route)-[:PASSES_THROUGH]->(c:Chokepoint {id: $chokepoint_id})
    MATCH (s:Supplier)-[tf:EXPORTS {route: r.id}]->(dest:Country)
    OPTIONAL MATCH (asset:EnergyAsset)-[:LOCATED_IN]->(dest)
    RETURN dest.id AS Country, sum(tf.volume) AS ExposedVolume, collect(DISTINCT asset.id) AS ExposedAssets
    """
    return neo4j_client.execute_read(query, chokepoint_id=chokepoint_id)
