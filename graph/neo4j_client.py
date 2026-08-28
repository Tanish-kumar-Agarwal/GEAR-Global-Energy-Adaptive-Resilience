import os
from neo4j import GraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "gear_neo4j_pass")
NEO4J_CONNECTION_TIMEOUT = float(os.getenv("NEO4J_CONNECTION_TIMEOUT", "2.0"))

class Neo4jClient:
    def __init__(self):
        try:
            self.driver = GraphDatabase.driver(
                NEO4J_URI,
                auth=(NEO4J_USER, NEO4J_PASSWORD),
                connection_timeout=NEO4J_CONNECTION_TIMEOUT
            )
        except Exception:
            self.driver = None

    def close(self):
        if self.driver:
            self.driver.close()

    def execute_write(self, query, **kwargs):
        if not self.driver:
            raise ConnectionError("Neo4j driver uninitialized")
        with self.driver.session() as session:
            return session.execute_write(lambda tx: tx.run(query, **kwargs).data())

    def execute_read(self, query, **kwargs):
        if not self.driver:
            raise ConnectionError("Neo4j driver uninitialized")
        with self.driver.session() as session:
            return session.execute_read(lambda tx: tx.run(query, **kwargs).data())

neo4j_client = Neo4jClient()
