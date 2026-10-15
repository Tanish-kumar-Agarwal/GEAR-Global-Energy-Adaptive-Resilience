import os
from neo4j import GraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "gear_neo4j_pass")
NEO4J_CONNECTION_TIMEOUT = float(os.getenv("NEO4J_CONNECTION_TIMEOUT", "0.5"))

class Neo4jClient:
    def __init__(self):
        try:
            self.driver = GraphDatabase.driver(
                NEO4J_URI,
                auth=(NEO4J_USER, NEO4J_PASSWORD),
                connection_timeout=NEO4J_CONNECTION_TIMEOUT,
                connection_acquisition_timeout=NEO4J_CONNECTION_TIMEOUT,
                max_connection_lifetime=60.0
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
            result = session.run(query, **kwargs)
            return [record.data() for record in result]

    def execute_read(self, query, **kwargs):
        if not self.driver:
            raise ConnectionError("Neo4j driver uninitialized")
        with self.driver.session() as session:
            result = session.run(query, **kwargs)
            return [record.data() for record in result]

neo4j_client = Neo4jClient()
