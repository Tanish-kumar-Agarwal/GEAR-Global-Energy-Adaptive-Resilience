import os
import sys
import uuid
from datetime import datetime, timezone

# Add apps/api to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "apps", "api"))

from core.database import SessionLocal, engine
from models.domain import Base, Country, Commodity, Supplier, Route, Chokepoint, EnergyAsset, TradeFlow, GeopoliticalEvent

def seed_database():
    db = SessionLocal()
    try:
        print("Starting deterministic seed...")

        # Clear existing data (in reverse dependency order)
        db.query(GeopoliticalEvent).delete()
        db.query(TradeFlow).delete()
        db.query(EnergyAsset).delete()
        db.query(Chokepoint).delete()
        db.query(Route).delete()
        db.query(Supplier).delete()
        db.query(Commodity).delete()
        db.query(Country).delete()
        db.commit()

        # 1. Countries
        countries = [
            Country(id="IND", name="India", region="South Asia"),
            Country(id="SAU", name="Saudi Arabia", region="Middle East"),
            Country(id="ARE", name="United Arab Emirates", region="Middle East"),
            Country(id="CHN", name="China", region="East Asia"),
            Country(id="JPN", name="Japan", region="East Asia"),
            Country(id="USA", name="United States", region="North America"),
            Country(id="QAT", name="Qatar", region="Middle East"),
        ]
        db.add_all(countries)

        # 2. Commodities
        commodities = [
            Commodity(id="CRUDE_OIL", name="Crude Oil"),
            Commodity(id="LNG", name="Liquefied Natural Gas"),
        ]
        db.add_all(commodities)

        # 3. Suppliers
        suppliers = [
            Supplier(id="SAU_ARAMCO", name="Saudi Aramco", country_id="SAU", reliability_score=0.98),
            Supplier(id="ARE_ADNOC", name="ADNOC", country_id="ARE", reliability_score=0.95),
            Supplier(id="QAT_ENERGY", name="QatarEnergy", country_id="QAT", reliability_score=0.97),
            Supplier(id="USA_EXXON", name="ExxonMobil", country_id="USA", reliability_score=0.99),
        ]
        db.add_all(suppliers)

        # 4. Routes
        routes = [
            Route(id="RT_HORMUZ_ASIA", name="Middle East to Asia via Hormuz", capacity=21.0, transit_time_days=14),
            Route(id="RT_US_ASIA", name="US Gulf to Asia via Panama", capacity=5.0, transit_time_days=25),
        ]
        db.add_all(routes)

        # 5. Chokepoints
        chokepoints = [
            Chokepoint(id="CHK_HORMUZ", name="Strait of Hormuz", risk_factor=0.3, latitude=26.5667, longitude=56.2500),
            Chokepoint(id="CHK_MALACCA", name="Strait of Malacca", risk_factor=0.1, latitude=1.43, longitude=102.89),
        ]
        db.add_all(chokepoints)

        # 6. Energy Assets (Ports, Refineries)
        assets = [
            EnergyAsset(id="PRT_RAS_TANURA", name="Ras Tanura Port", type="PORT", country_id="SAU", capacity=6.5, latitude=26.64, longitude=50.16),
            EnergyAsset(id="PRT_JAMNAGAR", name="Jamnagar Port", type="PORT", country_id="IND", capacity=1.2, latitude=22.47, longitude=69.93),
            EnergyAsset(id="REF_JAMNAGAR", name="Reliance Jamnagar Refinery", type="REFINERY", country_id="IND", capacity=1.24, latitude=22.33, longitude=69.88),
            EnergyAsset(id="STR_YOKOHAMA", name="Yokohama Strategic Reserve", type="STORAGE", country_id="JPN", capacity=50.0, latitude=35.44, longitude=139.63),
        ]
        db.add_all(assets)

        # 7. Trade Flows
        flows = [
            TradeFlow(supplier_id="SAU_ARAMCO", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_ASIA", volume=1.0),
            TradeFlow(supplier_id="SAU_ARAMCO", destination_country_id="CHN", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_ASIA", volume=1.8),
            TradeFlow(supplier_id="QAT_ENERGY", destination_country_id="JPN", commodity_id="LNG", route_id="RT_HORMUZ_ASIA", volume=0.8),
            TradeFlow(supplier_id="USA_EXXON", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_US_ASIA", volume=0.2),
        ]
        db.add_all(flows)

        # 8. Geopolitical Events (Baseline active risks)
        events = [
            GeopoliticalEvent(
                type="MARITIME_THREAT", 
                location="Strait of Hormuz", 
                severity=0.2, 
                affected_entity_id="CHK_HORMUZ", 
                confidence=0.85, 
                source_id="DEMO_SEED_DATA"
            )
        ]
        db.add_all(events)

        db.commit()
        print("Database seeded successfully with MVP dataset!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
