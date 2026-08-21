"""
Deterministic MVP topology.

Volumes, transit figures and reserve capacities are reference-scale values taken from
published sources (EIA World Oil Transit Chokepoints for chokepoint throughput, ISPRL for
India's strategic reserve, IEA for the 90-day stockholding obligation). They describe the
physical world the digital twin models; every derived number the API returns is computed
from these rows, never hard-coded in a route or a component.

Re-running this script is safe: it clears the topology tables and rebuilds them.
"""

import os
import sys
import uuid
from datetime import datetime, timezone

# Add apps/api to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "apps", "api"))

from core.database import SessionLocal, engine
from models.domain import (
    Base, Country, Commodity, Supplier, Route, Chokepoint, EnergyAsset, TradeFlow,
    GeopoliticalEvent, RiskScore, OutboxEvent, MarketPrice,
)


def seed_database():
    db = SessionLocal()
    try:
        print("Starting deterministic seed...")

        # Clear existing data (children before parents)
        # Market price observations reference commodities and must go first.
        db.query(MarketPrice).delete()
        db.query(RiskScore).delete()
        db.query(OutboxEvent).delete()
        db.query(GeopoliticalEvent).delete()
        db.query(TradeFlow).delete()
        db.query(EnergyAsset).delete()
        db.query(Route).delete()
        db.query(Chokepoint).delete()
        db.query(Supplier).delete()
        db.query(Commodity).delete()
        db.query(Country).delete()
        db.commit()

        # 1. Countries. reserve_target_days is only set where a published stockholding
        # obligation or stated national goal exists, so coverage is never judged against
        # an invented target.
        countries = [
            Country(id="IND", name="India", region="South Asia", reserve_target_days=90),
            Country(id="SAU", name="Saudi Arabia", region="Middle East"),
            Country(id="ARE", name="United Arab Emirates", region="Middle East"),
            Country(id="IRQ", name="Iraq", region="Middle East"),
            Country(id="KWT", name="Kuwait", region="Middle East"),
            Country(id="QAT", name="Qatar", region="Middle East"),
            Country(id="RUS", name="Russia", region="Eurasia"),
            Country(id="CHN", name="China", region="East Asia"),
            Country(id="JPN", name="Japan", region="East Asia", reserve_target_days=90),
            Country(id="KOR", name="South Korea", region="East Asia", reserve_target_days=90),
            Country(id="USA", name="United States", region="North America", reserve_target_days=90),
            Country(id="NLD", name="Netherlands", region="Europe", reserve_target_days=90),
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
            Supplier(id="IRQ_SOMO", name="Iraq SOMO", country_id="IRQ", reliability_score=0.88),
            Supplier(id="KWT_KPC", name="Kuwait Petroleum Corporation", country_id="KWT", reliability_score=0.94),
            Supplier(id="RUS_ROSNEFT", name="Rosneft", country_id="RUS", reliability_score=0.82),
            Supplier(id="USA_EXXON", name="ExxonMobil", country_id="USA", reliability_score=0.99),
        ]
        db.add_all(suppliers)

        # 4. Chokepoints. daily_transit_volume is published throughput (EIA), used for
        # exposure weighting and for the regional heatmap rollup.
        chokepoints = [
            Chokepoint(id="CHK_HORMUZ", name="Strait of Hormuz", risk_factor=0.3,
                       latitude=26.5667, longitude=56.2500, region="Middle East", daily_transit_volume=20.0),
            Chokepoint(id="CHK_MALACCA", name="Strait of Malacca", risk_factor=0.1,
                       latitude=1.43, longitude=102.89, region="Southeast Asia", daily_transit_volume=16.0),
            Chokepoint(id="CHK_BAB_EL_MANDEB", name="Bab el-Mandeb", risk_factor=0.25,
                       latitude=12.58, longitude=43.33, region="Middle East", daily_transit_volume=6.2),
            Chokepoint(id="CHK_SUEZ", name="Suez Canal and SUMED", risk_factor=0.15,
                       latitude=30.02, longitude=32.35, region="North Africa", daily_transit_volume=5.5),
            Chokepoint(id="CHK_CAPE", name="Cape of Good Hope", risk_factor=0.05,
                       latitude=-34.35, longitude=18.47, region="Southern Africa", daily_transit_volume=5.0),
            Chokepoint(id="CHK_PANAMA", name="Panama Canal", risk_factor=0.1,
                       latitude=9.08, longitude=-79.68, region="Central America", daily_transit_volume=1.0),
        ]
        db.add_all(chokepoints)

        # 5. Routes. path is an ordered [lng, lat] waypoint list drawn straight onto the
        # War Room map; chokepoint_id is the binding chokepoint the route must transit.
        routes = [
            Route(
                id="RT_HORMUZ_INDIA", name="Persian Gulf to West India via Hormuz",
                capacity=5.0, transit_time_days=5, chokepoint_id="CHK_HORMUZ",
                path=[[50.16, 26.64], [53.20, 26.90], [56.25, 26.57], [59.50, 24.50], [65.00, 22.40], [69.93, 22.47]],
            ),
            Route(
                id="RT_HORMUZ_CHINA", name="Persian Gulf to East China via Hormuz and Malacca",
                capacity=6.5, transit_time_days=20, chokepoint_id="CHK_HORMUZ",
                path=[[50.16, 26.64], [56.25, 26.57], [60.00, 22.00], [72.00, 12.00], [85.00, 6.00],
                      [102.89, 1.43], [107.00, 5.00], [113.00, 15.00], [121.50, 29.87]],
            ),
            Route(
                id="RT_HORMUZ_JAPAN", name="Persian Gulf to Japan via Hormuz and Malacca",
                capacity=4.0, transit_time_days=24, chokepoint_id="CHK_HORMUZ",
                path=[[51.53, 25.29], [56.25, 26.57], [62.00, 20.00], [75.00, 8.00], [95.00, 3.00],
                      [102.89, 1.43], [110.00, 8.00], [122.00, 22.00], [135.00, 33.00], [139.63, 35.44]],
            ),
            Route(
                id="RT_BALTIC_INDIA", name="Baltic and Black Sea to India via Suez",
                capacity=2.5, transit_time_days=26, chokepoint_id="CHK_SUEZ",
                path=[[29.75, 59.90], [12.00, 55.00], [-5.60, 36.00], [18.00, 33.00], [32.35, 30.02],
                      [38.00, 20.00], [43.33, 12.58], [58.00, 18.00], [69.93, 22.47]],
            ),
            Route(
                id="RT_REDSEA_EUROPE", name="Persian Gulf to Rotterdam via Bab el-Mandeb and Suez",
                capacity=3.0, transit_time_days=21, chokepoint_id="CHK_BAB_EL_MANDEB",
                path=[[48.80, 29.35], [56.25, 26.57], [58.00, 18.00], [50.00, 13.00], [43.33, 12.58],
                      [38.00, 20.00], [32.35, 30.02], [20.00, 34.50], [-5.60, 36.00], [4.40, 51.90]],
            ),
            Route(
                id="RT_CAPE_EUROPE", name="Persian Gulf to Rotterdam via Cape of Good Hope",
                capacity=3.5, transit_time_days=38, chokepoint_id="CHK_CAPE",
                path=[[50.16, 26.64], [56.25, 26.57], [60.00, 15.00], [55.00, -10.00], [35.00, -30.00],
                      [18.47, -34.35], [0.00, -15.00], [-10.00, 20.00], [4.40, 51.90]],
            ),
            Route(
                id="RT_US_ASIA", name="US Gulf to Asia via Panama",
                capacity=1.5, transit_time_days=25, chokepoint_id="CHK_PANAMA",
                path=[[-94.80, 29.30], [-84.00, 22.00], [-79.68, 9.08], [-100.00, 8.00], [-140.00, 15.00],
                      [170.00, 20.00], [120.00, 20.00], [80.00, 12.00], [69.93, 22.47]],
            ),
        ]
        db.add_all(routes)

        # 6. Energy Assets. STORAGE capacities are strategic reserve volumes in million
        # barrels; PORT and REFINERY capacities are throughput in million barrels/day.
        assets = [
            EnergyAsset(id="PRT_RAS_TANURA", name="Ras Tanura Port", type="PORT", country_id="SAU",
                        capacity=6.5, latitude=26.64, longitude=50.16),
            EnergyAsset(id="PRT_BASRA", name="Basra Oil Terminal", type="PORT", country_id="IRQ",
                        capacity=3.3, latitude=29.68, longitude=48.80),
            EnergyAsset(id="PRT_RUWAIS", name="Ruwais Terminal", type="PORT", country_id="ARE",
                        capacity=1.6, latitude=24.11, longitude=52.73),
            EnergyAsset(id="PRT_RAS_LAFFAN", name="Ras Laffan LNG Terminal", type="PORT", country_id="QAT",
                        capacity=2.1, latitude=25.90, longitude=51.53),
            EnergyAsset(id="PRT_JAMNAGAR", name="Jamnagar Port", type="PORT", country_id="IND",
                        capacity=1.2, latitude=22.47, longitude=69.93),
            EnergyAsset(id="REF_JAMNAGAR", name="Reliance Jamnagar Refinery", type="REFINERY", country_id="IND",
                        capacity=1.24, latitude=22.33, longitude=69.88),
            EnergyAsset(id="REF_ROTTERDAM", name="Shell Pernis Refinery", type="REFINERY", country_id="NLD",
                        capacity=0.40, latitude=51.88, longitude=4.35),
            EnergyAsset(id="REF_NINGBO", name="Zhenhai Refinery", type="REFINERY", country_id="CHN",
                        capacity=0.46, latitude=29.87, longitude=121.55),
            # India strategic reserve, ISPRL Phase I caverns (~39 million barrels total)
            EnergyAsset(id="STR_VISAKHAPATNAM", name="Visakhapatnam Strategic Reserve", type="STORAGE",
                        country_id="IND", capacity=9.8, latitude=17.69, longitude=83.22),
            EnergyAsset(id="STR_MANGALORE", name="Mangalore Strategic Reserve", type="STORAGE",
                        country_id="IND", capacity=11.0, latitude=12.91, longitude=74.85),
            EnergyAsset(id="STR_PADUR", name="Padur Strategic Reserve", type="STORAGE",
                        country_id="IND", capacity=18.3, latitude=13.42, longitude=74.72),
            EnergyAsset(id="STR_JPN_NATIONAL", name="Japan National Petroleum Stockpile", type="STORAGE",
                        country_id="JPN", capacity=320.0, latitude=35.44, longitude=139.63),
            EnergyAsset(id="STR_NLD_APETRA", name="Rotterdam Compulsory Stocks", type="STORAGE",
                        country_id="NLD", capacity=42.0, latitude=51.95, longitude=4.14),
        ]
        db.add_all(assets)

        # 7. Trade Flows, in million barrels/day of crude equivalent.
        flows = [
            # India: ~4.25 Mb/d of imports, the majority behind Hormuz
            TradeFlow(supplier_id="IRQ_SOMO", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_INDIA", volume=0.95),
            TradeFlow(supplier_id="SAU_ARAMCO", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_INDIA", volume=0.75),
            TradeFlow(supplier_id="ARE_ADNOC", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_INDIA", volume=0.35),
            TradeFlow(supplier_id="KWT_KPC", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_INDIA", volume=0.25),
            TradeFlow(supplier_id="RUS_ROSNEFT", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_BALTIC_INDIA", volume=1.70),
            TradeFlow(supplier_id="USA_EXXON", destination_country_id="IND", commodity_id="CRUDE_OIL", route_id="RT_US_ASIA", volume=0.25),
            # China
            TradeFlow(supplier_id="SAU_ARAMCO", destination_country_id="CHN", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_CHINA", volume=1.80),
            TradeFlow(supplier_id="IRQ_SOMO", destination_country_id="CHN", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_CHINA", volume=1.10),
            TradeFlow(supplier_id="ARE_ADNOC", destination_country_id="CHN", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_CHINA", volume=0.50),
            # Japan
            TradeFlow(supplier_id="SAU_ARAMCO", destination_country_id="JPN", commodity_id="CRUDE_OIL", route_id="RT_HORMUZ_JAPAN", volume=1.00),
            TradeFlow(supplier_id="QAT_ENERGY", destination_country_id="JPN", commodity_id="LNG", route_id="RT_HORMUZ_JAPAN", volume=0.80),
            # Europe
            TradeFlow(supplier_id="SAU_ARAMCO", destination_country_id="NLD", commodity_id="CRUDE_OIL", route_id="RT_CAPE_EUROPE", volume=0.50),
            TradeFlow(supplier_id="KWT_KPC", destination_country_id="NLD", commodity_id="CRUDE_OIL", route_id="RT_REDSEA_EUROPE", volume=0.30),
        ]
        db.add_all(flows)

        # 8. Baseline geopolitical event. Live risk scores are produced by the ingestion
        # pipeline (scripts/ingest.py), not seeded here.
        events = [
            GeopoliticalEvent(
                type="MARITIME_THREAT",
                title="Elevated naval activity reported in the Strait of Hormuz",
                description="Baseline maritime threat level for the chokepoint.",
                location="Strait of Hormuz",
                latitude=26.5667,
                longitude=56.25,
                severity=0.2,
                affected_entity_id="CHK_HORMUZ",
                confidence=0.85,
                source_id="DEMO_SEED_DATA",
                source_event_id="SEED-BASELINE-HORMUZ-001",
            )
        ]
        db.add_all(events)

        # 9. Route chokepoint linkage, derived from the assets/chokepoints seeded
        # above. Seeded paths are kept; only missing geometry is filled in.
        db.flush()
        from services.route_geometry import derive_route_geometries
        geometries = derive_route_geometries(db)
        for route in routes:
            geo = geometries.get(route.id)
            if geo:
                if route.path is None:
                    route.path = geo["path"]
                if route.chokepoint_ids is None:
                    route.chokepoint_ids = geo["chokepoint_ids"]
            if route.chokepoint_ids is None and route.chokepoint_id:
                # Derivation needs trade flows; routes without any still carry
                # their declared FK so scenario impact can reach them.
                route.chokepoint_ids = [route.chokepoint_id]

        db.commit()
        print("Database seeded successfully with MVP dataset!")
        print(f"  countries={len(countries)} suppliers={len(suppliers)} chokepoints={len(chokepoints)}")
        print(f"  routes={len(routes)} assets={len(assets)} trade_flows={len(flows)}")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
