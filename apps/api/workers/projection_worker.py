from .celery_app import celery_app
from core.database import SessionLocal
from models.domain import OutboxEvent, JobStatus
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "graph"))
from graph.neo4j_client import neo4j_client
from datetime import datetime, timezone

@celery_app.task(name="projection_worker.process_outbox")
def process_outbox_events():
    """
    Scans the PostgreSQL Outbox for queued events and projects them into Neo4j.
    """
    db = SessionLocal()
    try:
        # Fetch pending outbox events
        events = db.query(OutboxEvent).filter(OutboxEvent.status == JobStatus.QUEUED).limit(100).all()
        
        for event in events:
            try:
                # Basic idempotent mapping logic for the MVP
                payload = event.payload
                
                if event.aggregate_type == "Country":
                    neo4j_client.execute_write(
                        "MERGE (n:Country {id: $id}) SET n.name = $name",
                        id=payload["id"], name=payload.get("name", "")
                    )
                # In a full implementation, we'd map all entities here.
                # For the MVP, we rely mostly on the bulk graph loader to set initial state,
                # but this demonstrates the outbox pattern loop.

                event.status = JobStatus.COMPLETED
                event.processed_at = datetime.now(timezone.utc)
            except Exception as e:
                event.status = JobStatus.FAILED
                event.retry_count += 1
                
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
