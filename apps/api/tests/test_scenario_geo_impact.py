import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
# repo root, so the top-level simulation package resolves
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from core.database import Base
from models.domain import Route, Chokepoint
from simulation.cascade.impact import compute_geo_impact

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    session.add_all([
        Chokepoint(id="CHK_HORMUZ", name="Strait of Hormuz", risk_factor=0.3, latitude=26.5667, longitude=56.25),
        Chokepoint(id="CHK_MALACCA", name="Strait of Malacca", risk_factor=0.1, latitude=1.43, longitude=102.89),
        Route(id="RT_HORMUZ_ASIA", name="Middle East to Asia via Hormuz", capacity=21.0,
              transit_time_days=14, chokepoint_ids=["CHK_HORMUZ"]),
        Route(id="RT_US_ASIA", name="US Gulf to Asia via Panama", capacity=5.0,
              transit_time_days=25, chokepoint_ids=[]),
    ])
    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def _by_id(items, key):
    return {i[key]: i for i in items}


def test_impact_keys_by_route_and_chokepoint(db):
    impact = compute_geo_impact(db, "CHK_HORMUZ", severity=0.8, duration_days=30)
    routes = _by_id(impact["impacted_routes"], "route_id")
    cps = _by_id(impact["impacted_chokepoints"], "chokepoint_id")

    # Route through the target chokepoint is impacted; unrelated route is not
    assert "RT_HORMUZ_ASIA" in routes
    assert "RT_US_ASIA" not in routes
    assert "CHK_HORMUZ" in cps
    # Every entry carries risk_score and status
    assert routes["RT_HORMUZ_ASIA"]["status"] in ("stable", "at_risk", "disrupted")
    assert cps["CHK_HORMUZ"]["risk_score"] > 30.0


def test_severity_changes_scores(db):
    low = compute_geo_impact(db, "CHK_HORMUZ", severity=0.3, duration_days=30)
    high = compute_geo_impact(db, "CHK_HORMUZ", severity=0.9, duration_days=30)

    low_cp = _by_id(low["impacted_chokepoints"], "chokepoint_id")["CHK_HORMUZ"]
    high_cp = _by_id(high["impacted_chokepoints"], "chokepoint_id")["CHK_HORMUZ"]
    assert high_cp["risk_score"] > low_cp["risk_score"]

    low_rt = _by_id(low["impacted_routes"], "route_id")["RT_HORMUZ_ASIA"]
    high_rt = _by_id(high["impacted_routes"], "route_id")["RT_HORMUZ_ASIA"]
    assert high_rt["risk_score"] > low_rt["risk_score"]
    # High severity on the target pushes it into disrupted
    assert high_cp["status"] == "disrupted"


def test_duration_changes_scores(db):
    short = compute_geo_impact(db, "CHK_HORMUZ", severity=0.5, duration_days=10)
    long = compute_geo_impact(db, "CHK_HORMUZ", severity=0.5, duration_days=90)

    short_rt = _by_id(short["impacted_routes"], "route_id")["RT_HORMUZ_ASIA"]
    long_rt = _by_id(long["impacted_routes"], "route_id")["RT_HORMUZ_ASIA"]
    assert long_rt["risk_score"] > short_rt["risk_score"]


def test_affected_route_ids_from_cascade_are_included(db):
    impact = compute_geo_impact(
        db, "CHK_MALACCA", severity=0.5, duration_days=30,
        affected_route_ids=["RT_US_ASIA"]
    )
    routes = _by_id(impact["impacted_routes"], "route_id")
    assert "RT_US_ASIA" in routes
