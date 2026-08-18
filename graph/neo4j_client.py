import os
from neo4j import GraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "gear_neo4j_pass")

class Neo4jClient:
    def __init__(self):
        self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    def close(self):
        self.driver.close()

    def execute_write(self, query, **kwargs):
        with self.driver.session() as session:
            return session.execute_write(lambda tx: tx.run(query, **kwargs).data())

    def execute_read(self, query, **kwargs):
        with self.driver.session() as session:
            return session.execute_read(lambda tx: tx.run(query, **kwargs).data())

neo4j_client = Neo4jClient()
