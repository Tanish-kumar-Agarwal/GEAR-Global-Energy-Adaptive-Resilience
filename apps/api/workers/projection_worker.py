from .celery_app import celery_app
from core.database import SessionLocal
from models.domain import OutboxEvent, JobStatus
import sys
import os
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
from graph.neo4j_client import neo4j_client

@celery_app.task(name="projection_worker.process_outbox", bind=True, max_retries=3)
def process_outbox_events(self):
    """
    Scans the PostgreSQL Outbox for queued events and projects them into Neo4j.
    """
    db = SessionLocal()
    try:
        # Fetch pending outbox events
        events = db.query(OutboxEvent).filter(OutboxEvent.status == JobStatus.QUEUED).limit(100).all()
        
        for event in events:
            try:
                payload = event.payload
                
                # Check neo4j connectivity before proceeding with each event
                # This ensures we don't mark as processed if Neo4j is down
                try:
                    neo4j_client.execute_read("RETURN 1") 
                except Exception as neo_err:
                    raise ConnectionError(f"Neo4j unavailable: {neo_err}")
                                
                if event.aggregate_type == "Country":
                    neo4j_client.execute_write(
                        "MERGE (n:Country {id: $id}) SET n.name = $name",
                        id=payload["id"], name=payload.get("name", "")
                    )
                    
                elif event.aggregate_type == "Supplier":
                    neo4j_client.execute_write(
                        "MERGE (n:Supplier {id: $id}) SET n.name = $name",
                        id=payload["id"], name=payload.get("name", "")
                    )
                    if payload.get("country_id"):
                        neo4j_client.execute_write(
                            "MATCH (s:Supplier {id: $s_id}), (c:Country {id: $c_id}) MERGE (s)-[:LOCATED_IN]->(c)",
                            s_id=payload["id"], c_id=payload["country_id"]
                        )
                
                elif event.aggregate_type == "Commodity":
                    neo4j_client.execute_write(
                        "MERGE (n:Commodity {id: $id}) SET n.name = $name",
                        id=payload["id"], name=payload.get("name", "")
                    )
                
                elif event.aggregate_type == "EnergyAsset":
                    label = payload.get("type", "Asset").capitalize()
                    neo4j_client.execute_write(
                        f"MERGE (n:EnergyAsset:{label} {{id: $id}}) SET n.name = $name, n.capacity = $cap",
                        id=payload["id"], name=payload.get("name", ""), cap=payload.get("capacity", 0.0)
                    )
                    if payload.get("country_id"):
                        neo4j_client.execute_write(
                            "MATCH (a:EnergyAsset {id: $a_id}), (c:Country {id: $c_id}) MERGE (a)-[:LOCATED_IN]->(c)",
                            a_id=payload["id"], c_id=payload["country_id"]
                        )
                
                elif event.aggregate_type == "Route":
                    neo4j_client.execute_write(
                        "MERGE (n:Route {id: $id}) SET n.name = $name, n.capacity = $cap",
                        id=payload["id"], name=payload.get("name", ""), cap=payload.get("capacity", 0.0)
                    )
                    # Project the route's chokepoint linkage so cascades on a
                    # chokepoint can reach the flows that pass through it.
                    # MERGE on id alone: the Chokepoint event may arrive later
                    # and will fill in the name.
                    for cp_id in (payload.get("chokepoint_ids") or []):
                        neo4j_client.execute_write(
                            """
                            MATCH (r:Route {id: $r_id})
                            MERGE (c:Chokepoint {id: $c_id})
                            MERGE (r)-[:PASSES_THROUGH]->(c)
                            """,
                            r_id=payload["id"], c_id=cp_id
                        )
                
                elif event.aggregate_type == "Chokepoint":
                    neo4j_client.execute_write(
                        "MERGE (n:Chokepoint {id: $id}) SET n.name = $name",
                        id=payload["id"], name=payload.get("name", "")
                    )
                    
                elif event.aggregate_type == "TradeFlow":
                    tf_id = str(payload["id"])
                    neo4j_client.execute_write(
                        "MERGE (tf:TradeFlow {id: $id}) SET tf.volume = $vol",
                        id=tf_id, vol=payload.get("volume", 0.0)
                    )
                    
                    # Merge relationships dynamically if references exist
                    neo4j_client.execute_write(
                        """
                        MATCH (tf:TradeFlow {id: $tf_id})
                        OPTIONAL MATCH (s:Supplier {id: $s_id})
                        OPTIONAL MATCH (d:Country {id: $d_id})
                        OPTIONAL MATCH (r:Route {id: $r_id})
                        OPTIONAL MATCH (com:Commodity {id: $com_id})
                        
                        FOREACH (x IN CASE WHEN d IS NOT NULL THEN [1] ELSE [] END | MERGE (tf)-[:DESTINED_FOR]->(d))
                        FOREACH (x IN CASE WHEN r IS NOT NULL THEN [1] ELSE [] END | MERGE (tf)-[:USES_ROUTE]->(r))
                        FOREACH (x IN CASE WHEN com IS NOT NULL THEN [1] ELSE [] END | MERGE (tf)-[:INVOLVES_COMMODITY]->(com))
                        FOREACH (x IN CASE WHEN s IS NOT NULL THEN [1] ELSE [] END | MERGE (s)-[:EXPORTS_VIA]->(tf))
                        FOREACH (x IN CASE WHEN s IS NOT NULL AND com IS NOT NULL THEN [1] ELSE [] END | MERGE (s)-[:SUPPLIES_COMMODITY]->(com))
                        """,
                        tf_id=tf_id, 
                        s_id=payload.get("supplier_id"), 
                        d_id=payload.get("destination_country_id"), 
                        r_id=payload.get("route_id"), 
                        com_id=payload.get("commodity_id")
                    )
                    
                    neo4j_client.execute_write(
                        """
                        MATCH (tf:TradeFlow {id: $tf_id})<-[:EXPORTS_VIA]-(s:Supplier)-[:LOCATED_IN]->(orig:Country)
                        MERGE (tf)-[:ORIGINATES_FROM]->(orig)
                        """,
                        tf_id=tf_id
                    )
                    
                elif event.aggregate_type == "GeopoliticalEvent":
                    neo4j_client.execute_write(
                        """
                        MERGE (e:GeopoliticalEvent {id: $id})
                        SET e.source_id = $source_id,
                            e.event_type = $event_type,
                            e.title = $title,
                            e.severity = $severity,
                            e.confidence = $confidence,
                            e.event_time = $event_time,
                            e.latitude = $lat,
                            e.longitude = $lng
                        """,
                        id=payload["source_event_id"],
                        source_id=payload.get("source_id"),
                        event_type=payload.get("event_type"),
                        title=payload.get("title"),
                        severity=payload.get("severity"),
                        confidence=payload.get("confidence"),
                        event_time=payload.get("event_time"),
                        lat=payload.get("latitude"),
                        lng=payload.get("longitude")
                    )
                    
                    affected_id = payload.get("affected_entity_id")
                    if affected_id:
                        # We don't know the label ahead of time perfectly, but we can match on ID.
                        # Usually it's Country or Chokepoint for MVP
                        neo4j_client.execute_write(
                            """
                            MATCH (e:GeopoliticalEvent {id: $event_id})
                            MATCH (target {id: $target_id})
                            MERGE (e)-[:AFFECTS]->(target)
                            """,
                            event_id=payload["source_event_id"],
                            target_id=affected_id
                        )

                elif event.aggregate_type == "RiskScore":
                    # Assumes target node already exists. 
                    # Creates RiskScore node and ties it to target.
                    entity_id = payload["entity_id"]
                    neo4j_client.execute_write(
                        """
                        MERGE (r:RiskScore {id: $risk_id})
                        SET r.score = $score, r.level = $level
                        """,
                        risk_id=f"RISK_{entity_id}",
                        score=payload["score"],
                        level=payload["level"]
                    )
                    
                    neo4j_client.execute_write(
                        """
                        MATCH (r:RiskScore {id: $risk_id})
                        MATCH (target {id: $target_id})
                        MERGE (r)-[:ASSESSES]->(target)
                        """,
                        risk_id=f"RISK_{entity_id}",
                        target_id=entity_id
                    )

                event.status = JobStatus.COMPLETED
                event.processed_at = datetime.now(timezone.utc)
                
            except ConnectionError as ce:
                logger.error(f"Infrastructure error during outbox processing: {ce}")
                # Do not increment retry_count for infrastructure failures
                # Break the loop to retry the whole task later
                db.rollback()
                raise self.retry(exc=ce, countdown=10)
            except Exception as e:
                logger.error(f"Failed to process outbox event {event.id}: {e}")
                event.retry_count += 1
                if event.retry_count >= 3:
                    event.status = JobStatus.FAILED
                
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Database error during outbox processing: {e}")
        # Retry celery task if DB/Neo4j fails completely
        raise self.retry(exc=e, countdown=10)
    finally:
        db.close()
