import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from core.database import Base
from models.domain import OutboxEvent, JobStatus, EventType

engine = create_engine("sqlite:///:memory:")
SessionLocalTest = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

@pytest.fixture
def mock_neo4j():
    with patch("workers.projection_worker.neo4j_client") as mock:
        yield mock

@pytest.fixture
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocalTest()
    yield db
    db.close()

def test_process_geopolitical_event(db_session, mock_neo4j):
    from workers.projection_worker import process_outbox_events
    
    with patch("workers.projection_worker.SessionLocal", return_value=db_session):
        event = OutboxEvent(
            aggregate_type="GeopoliticalEvent",
            aggregate_id="EV-1",
            event_type=EventType.CREATE,
            status=JobStatus.QUEUED,
            payload={
                "source_event_id": "EV-1",
                "source_id": "TEST",
                "event_type": "Naval",
                "title": "Test Title",
                "severity": 0.8,
                "confidence": 0.9,
                "event_time": "2025-05-24T00:00:00",
                "latitude": 0.0,
                "longitude": 0.0,
                "affected_entity_id": "CHK_HORMUZ"
            }
        )
        db_session.add(event)
        db_session.commit()
        
        event_id = event.id
        
        mock_neo4j.execute_read.return_value = 1
        
        # We need to wrap it because it's a celery task
        process_outbox_events.apply()
        
        # Worker closed the session, so we fetch it again with a fresh session
        db_check = SessionLocalTest()
        event_after = db_check.query(OutboxEvent).get(event_id)
        
        assert event_after.status == JobStatus.COMPLETED
        assert event_after.processed_at is not None
        assert mock_neo4j.execute_write.call_count == 2 # 1 for node, 1 for edge
        db_check.close()

def test_process_risk_score(db_session, mock_neo4j):
    from workers.projection_worker import process_outbox_events
    
    with patch("workers.projection_worker.SessionLocal", return_value=db_session):
        event = OutboxEvent(
            aggregate_type="RiskScore",
            aggregate_id="CHK_HORMUZ",
            event_type=EventType.UPDATE,
            status=JobStatus.QUEUED,
            payload={
                "entity_id": "CHK_HORMUZ",
                "score": 85.0,
                "level": "CRITICAL"
            }
        )
        db_session.add(event)
        db_session.commit()
        
        event_id = event.id
        
        mock_neo4j.execute_read.return_value = 1
        process_outbox_events.apply()
        
        db_check = SessionLocalTest()
        event_after = db_check.query(OutboxEvent).get(event_id)
        
        assert event_after.status == JobStatus.COMPLETED
        assert mock_neo4j.execute_write.call_count == 2
        db_check.close()

def test_process_neo4j_down(db_session, mock_neo4j):
    from workers.projection_worker import process_outbox_events
    
    with patch("workers.projection_worker.SessionLocal", return_value=db_session):
        event = OutboxEvent(
            aggregate_type="RiskScore",
            aggregate_id="CHK_HORMUZ",
            event_type=EventType.UPDATE,
            status=JobStatus.QUEUED,
            payload={
                "entity_id": "CHK_HORMUZ",
                "score": 85.0,
                "level": "CRITICAL"
            }
        )
        db_session.add(event)
        db_session.commit()
        
        event_id = event.id
        
        # Simulate Neo4j being down
        mock_neo4j.execute_read.side_effect = Exception("Connection refused")
        
        process_outbox_events.apply()
        
        db_check = SessionLocalTest()
        event_after = db_check.query(OutboxEvent).get(event_id)
        
        # Expect retry to increment but not mark as processed or failed until 3 retries
        assert event_after.status == JobStatus.QUEUED
        assert event_after.retry_count == 1
        assert event_after.processed_at is None
        db_check.close()
