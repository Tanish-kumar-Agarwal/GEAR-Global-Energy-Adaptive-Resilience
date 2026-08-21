import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from core.database import Base
from models.domain import Country, Supplier, Route, Chokepoint, EnergyAsset, TradeFlow
from services.route_geometry import derive_route_geometries

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    session.add_all([
        Country(id="SAU", name="Saudi Arabia", region="Middle East"),
        Country(id="IND", name="India", region="South Asia"),
        Supplier(id="SAU_ARAMCO", name="Saudi Aramco", country_id="SAU", reliability_score=0.98),
        Route(id="RT_HORMUZ_ASIA", name="Middle East to Asia via Hormuz",
              capacity=21.0, transit_time_days=14),
        Chokepoint(id="CHK_HORMUZ", name="Strait of Hormuz", risk_factor=0.3, latitude=26.5667, longitude=56.25),
        Chokepoint(id="CHK_MALACCA", name="Strait of Malacca", risk_factor=0.1, latitude=1.43, longitude=102.89),
        EnergyAsset(id="PRT_RAS_TANURA", name="Ras Tanura Port", type="PORT", country_id="SAU", capacity=6.5, latitude=26.64, longitude=50.16),
        EnergyAsset(id="PRT_JAMNAGAR", name="Jamnagar Port", type="PORT", country_id="IND", capacity=1.2, latitude=22.47, longitude=69.93),
        TradeFlow(supplier_id="SAU_ARAMCO", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_ASIA", volume=1.0),
        TradeFlow(supplier_id="SAU_ARAMCO", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_ASIA", volume=1.8),
    ])
    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


def test_derive_route_geometries(db):
    geo = derive_route_geometries(db)
    assert "RT_HORMUZ_ASIA" in geo
    g = geo["RT_HORMUZ_ASIA"]
    # Origin port, Hormuz waypoint, destination port, in voyage order
    assert g["path"][0] == [50.16, 26.64]
    assert g["path"][-1] == [69.93, 22.47]
    assert g["chokepoint_ids"] == ["CHK_HORMUZ"]
    # Malacca is neither name-matched nor inside the corridor
    assert "CHK_MALACCA" not in g["chokepoint_ids"]


def test_routes_without_flows_are_omitted(db):
    db.add(Route(id="RT_NO_FLOWS", name="Route with no flows", capacity=1.0, transit_time_days=5))
    db.commit()
    geo = derive_route_geometries(db)
    assert "RT_NO_FLOWS" not in geo
