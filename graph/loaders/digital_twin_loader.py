import sys
import os

root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, os.path.join(root_dir, "apps", "api"))
sys.path.insert(0, root_dir)

from core.database import SessionLocal
from models.domain import Country, Supplier, Route, Chokepoint, EnergyAsset, TradeFlow
from graph.neo4j_client import neo4j_client

def load_full_graph_projection():
    """
    Idempotent loader that pulls authoritative topology from PostgreSQL
    and projects it into Neo4j as a Digital Twin.
    """
    db = SessionLocal()
    try:
        # Clear existing graph for MVP sync (In production, outbox handles deltas)
        neo4j_client.execute_write("MATCH (n) DETACH DELETE n")

        # 1. Countries
        countries = db.query(Country).all()
        for c in countries:
            neo4j_client.execute_write(
                "MERGE (n:Country {id: $id}) SET n.name = $name, n.region = $region",
                id=c.id, name=c.name, region=c.region
            )

        # 2. Suppliers
        suppliers = db.query(Supplier).all()
        for s in suppliers:
            neo4j_client.execute_write(
                "MERGE (n:Supplier {id: $id}) SET n.name = $name",
                id=s.id, name=s.name
            )
            neo4j_client.execute_write(
                "MATCH (s:Supplier {id: $s_id}), (c:Country {id: $c_id}) MERGE (s)-[:LOCATED_IN]->(c)",
                s_id=s.id, c_id=s.country_id
            )

        # 3. Energy Assets
        assets = db.query(EnergyAsset).all()
        for a in assets:
            label = a.type.capitalize() # Port, Refinery, Storage
            neo4j_client.execute_write(
                f"MERGE (n:EnergyAsset:{label} {{id: $id}}) SET n.name = $name, n.capacity = $cap",
                id=a.id, name=a.name, cap=a.capacity
            )
            neo4j_client.execute_write(
                "MATCH (a:EnergyAsset {id: $a_id}), (c:Country {id: $c_id}) MERGE (a)-[:LOCATED_IN]->(c)",
                a_id=a.id, c_id=a.country_id
            )

        # 4. Routes & Chokepoints
        routes = db.query(Route).all()
        for r in routes:
            neo4j_client.execute_write(
                "MERGE (n:Route {id: $id}) SET n.name = $name, n.capacity = $cap",
                id=r.id, name=r.name, cap=r.capacity
            )
        
        chokepoints = db.query(Chokepoint).all()
        for chk in chokepoints:
            neo4j_client.execute_write(
                "MERGE (n:Chokepoint {id: $id}) SET n.name = $name",
                id=chk.id, name=chk.name
            )
            # For MVP, assume Middle East to Asia routes pass through Hormuz/Malacca if applicable
            # In a real model, this mapping is explicit. For demo, we infer by name.
            neo4j_client.execute_write(
                """
                MATCH (r:Route), (c:Chokepoint)
                WHERE r.name CONTAINS 'Hormuz' AND c.id = 'CHK_HORMUZ'
                MERGE (r)-[:PASSES_THROUGH]->(c)
                """
            )

        # 5. Trade Flows (The core dependency edges)
        flows = db.query(TradeFlow).all()
        for f in flows:
            neo4j_client.execute_write(
                """
                MATCH (s:Supplier {id: $s_id}), (d:Country {id: $d_id}), (r:Route {id: $r_id})
                MERGE (s)-[tf:EXPORTS {route: $r_id, commodity: $com_id}]->(d)
                SET tf.volume = $vol
                MERGE (tf_route:Route {id: $r_id})-[:TRANSPORTS]->(d)
                """,
                s_id=f.supplier_id, d_id=f.destination_country_id, r_id=f.route_id, com_id=f.commodity_id, vol=f.volume
            )

        print("Graph projection complete!")

    finally:
        db.close()

if __name__ == "__main__":
    load_full_graph_projection()
