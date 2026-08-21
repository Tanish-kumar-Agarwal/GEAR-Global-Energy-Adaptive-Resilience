import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from core.database import get_db, Base
from core.security import get_current_user
from models.domain import Chokepoint, RiskLevel, RiskScore, Role, Route, User

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def override_get_current_user():
    return User(id="test-user-id", username="admin", role=Role.ADMIN, is_active=True)


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=engine)
    previous = dict(app.dependency_overrides)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    db = TestingSessionLocal()
    db.add_all([
        Chokepoint(id="CHK_HORMUZ", name="Strait of Hormuz", risk_factor=0.3, latitude=26.5667, longitude=56.25),
        Chokepoint(id="CHK_MALACCA", name="Strait of Malacca", risk_factor=0.1, latitude=1.43, longitude=102.89),
        Route(id="RT_HORMUZ_ASIA", name="Middle East to Asia via Hormuz", capacity=21.0,
              transit_time_days=14, chokepoint_ids=["CHK_HORMUZ", "CHK_MALACCA"]),
        # Live baseline: Hormuz is already near-critical, Malacca is quiet.
        RiskScore(id=uuid.uuid4(), entity_id="CHK_HORMUZ", score=91.8, level=RiskLevel.CRITICAL,
                  timestamp=datetime.now(timezone.utc)),
    ])
    db.commit()
    db.close()
    yield TestClient(app)
    app.dependency_overrides.clear()
    app.dependency_overrides.update(previous)
    Base.metadata.drop_all(bind=engine)


def preview(client, severity, target="CHK_MALACCA"):
    resp = client.post("/api/v1/scenarios/preview",
                       json={"target_id": target, "severity": severity, "duration_days": 30})
    assert resp.status_code == 200
    return resp.json()


def test_preview_is_labelled_estimate(client):
    body = preview(client, 0.5)
    assert body["is_estimate"] is True
    assert body["mode"] == "preview"
    assert body["method"] == "geo-impact-no-cascade"
    assert isinstance(body["computed_ms"], (int, float))


def test_preview_uses_overlay_status_vocabulary(client):
    body = preview(client, 0.9)
    statuses = {e["status"] for e in body["impacted_routes"] + body["impacted_chokepoints"]}
    assert statuses <= {"stable", "at_risk", "disrupted"}


def test_severity_changes_preview(client):
    low = preview(client, 0.3)
    high = preview(client, 0.9)
    low_cp = {c["chokepoint_id"]: c for c in low["impacted_chokepoints"]}["CHK_MALACCA"]
    high_cp = {c["chokepoint_id"]: c for c in high["impacted_chokepoints"]}["CHK_MALACCA"]
    assert high_cp["risk_score"] > low_cp["risk_score"]


def test_saturated_flags_near_max_baseline(client):
    body = preview(client, 0.5)
    assert "CHK_HORMUZ" in body["saturated"]
    assert "CHK_MALACCA" not in body["saturated"]
    # base_score is internal to the computation and must not leak
    for entry in body["impacted_routes"] + body["impacted_chokepoints"]:
        assert "base_score" not in entry


def test_severity_out_of_range_rejected(client):
    resp = client.post("/api/v1/scenarios/preview",
                       json={"target_id": "CHK_MALACCA", "severity": 1.5, "duration_days": 30})
    assert resp.status_code == 422
