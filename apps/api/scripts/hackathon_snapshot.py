import sys
import os
import uuid
from datetime import datetime, timezone

# Add the apps/api directory to PYTHONPATH
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(root_dir, "apps", "api"))
sys.path.insert(0, root_dir)

from core.database import SessionLocal, engine
from models.domain import (
    Country, Commodity, Supplier, Route, Chokepoint, EnergyAsset, 
    TradeFlow, GeopoliticalEvent, RiskScore, RiskLevel, Base
)

def get_or_create(db, model, defaults=None, **kwargs):
    instance = db.query(model).filter_by(**kwargs).first()
    if instance:
        if defaults:
            for key, value in defaults.items():
                setattr(instance, key, value)
        return instance, False
    else:
        params = dict((k, v) for k, v in kwargs.items())
        if defaults:
            params.update(defaults)
        instance = model(**params)
        db.add(instance)
        db.flush()
        return instance, True

def run_snapshot_seed():
    db = SessionLocal()
    print("Starting GEAR Hackathon Snapshot Seeding...")
    try:
        # 1. Countries
        countries_data = [
            {"id": "IND", "name": "India", "region": "South Asia"},
            {"id": "SAU", "name": "Saudi Arabia", "region": "Middle East"},
            {"id": "ARE", "name": "UAE", "region": "Middle East"},
            {"id": "QAT", "name": "Qatar", "region": "Middle East"},
            {"id": "IRN", "name": "Iran", "region": "Middle East"},
            {"id": "RUS", "name": "Russia", "region": "Europe/Asia"},
            {"id": "UKR", "name": "Ukraine", "region": "Europe"},
            {"id": "CHN", "name": "China", "region": "East Asia"},
            {"id": "SGP", "name": "Singapore", "region": "Southeast Asia"},
            {"id": "LKA", "name": "Sri Lanka", "region": "South Asia"}
        ]
        for c in countries_data:
            get_or_create(db, Country, id=c["id"], defaults={"name": c["name"], "region": c["region"]})
        
        # 2. Commodities
        commodities_data = [
            {"id": "CRUDE_OIL", "name": "Crude Oil"},
            {"id": "LNG", "name": "LNG"},
            {"id": "LPG", "name": "LPG"},
            {"id": "NATURAL_GAS", "name": "Natural Gas"},
            {"id": "SUNFLOWER_OIL", "name": "Sunflower Oil"},
            {"id": "SOYBEAN_OIL", "name": "Soybean Oil"},
            {"id": "PALM_OIL", "name": "Palm Oil"},
            {"id": "UREA", "name": "Urea"},
            {"id": "FERTILIZER", "name": "Fertilizer"},
            {"id": "PETROCHEMICAL_FEEDSTOCK", "name": "Petrochemical Feedstock"}
        ]
        for com in commodities_data:
            get_or_create(db, Commodity, id=com["id"], defaults={"name": com["name"]})

        # 3. Chokepoints
        chokepoints_data = [
            {"id": "CHK_HORMUZ", "name": "Strait of Hormuz", "latitude": 26.56, "longitude": 56.25, "risk_factor": 0.8},
            {"id": "CHK_BAB_EL_MANDEB", "name": "Bab el-Mandeb", "latitude": 12.58, "longitude": 43.33, "risk_factor": 0.7},
            {"id": "CHK_SUEZ", "name": "Suez Canal", "latitude": 30.6, "longitude": 32.3, "risk_factor": 0.4}
        ]
        for chk in chokepoints_data:
            get_or_create(db, Chokepoint, id=chk["id"], defaults={"name": chk["name"], "latitude": chk["latitude"], "longitude": chk["longitude"], "risk_factor": chk["risk_factor"]})

        # 4. Routes
        routes_data = [
            {"id": "RT_GULF_WEST_INDIA", "name": "Gulf -> West India", "capacity": 10.0, "transit_time_days": 4},
            {"id": "RT_GULF_WEST_COAST_REFINERIES", "name": "Gulf -> West Coast Refineries", "capacity": 8.0, "transit_time_days": 5},
            {"id": "RT_RUSSIA_INDIA_ENERGY", "name": "Russia -> India Energy Route", "capacity": 5.0, "transit_time_days": 25},
            {"id": "RT_RED_SEA_SUEZ", "name": "Red Sea -> Suez -> Europe/India", "capacity": 15.0, "transit_time_days": 14},
            {"id": "RT_BLACK_SEA_INDIA_AGRI", "name": "Black Sea -> India Agricultural Route", "capacity": 2.0, "transit_time_days": 20},
            {"id": "RT_SINGAPORE_INDIA", "name": "Singapore -> India", "capacity": 4.0, "transit_time_days": 6},
            {"id": "RT_COLOMBO_INDIA", "name": "Colombo -> India", "capacity": 6.0, "transit_time_days": 2}
        ]
        for r in routes_data:
            get_or_create(db, Route, id=r["id"], defaults={"name": r["name"], "capacity": r["capacity"], "transit_time_days": r["transit_time_days"]})

        # 5. Suppliers
        suppliers_data = [
            {"id": "SUP_RUSSIAN_CRUDE", "name": "Russian Crude Supplier", "country_id": "RUS", "reliability_score": 0.7},
            {"id": "SUP_GULF_CRUDE", "name": "Gulf Crude Supplier", "country_id": "SAU", "reliability_score": 0.9},
            {"id": "SUP_QATAR_LNG", "name": "Qatar LNG Supplier", "country_id": "QAT", "reliability_score": 0.95},
            {"id": "SUP_UAE_LPG", "name": "UAE LPG Supplier", "country_id": "ARE", "reliability_score": 0.9},
            {"id": "SUP_RUSSIAN_AGRI", "name": "Russian Agri Supplier", "country_id": "RUS", "reliability_score": 0.6},
            {"id": "SUP_UKRAINE_AGRI", "name": "Ukraine Agri Supplier", "country_id": "UKR", "reliability_score": 0.5}
        ]
        for s in suppliers_data:
            get_or_create(db, Supplier, id=s["id"], defaults={"name": s["name"], "country_id": s["country_id"], "reliability_score": s["reliability_score"]})

        # 6. Energy Assets
        assets_data = [
            {"id": "AST_WEST_COAST_REFINERY", "name": "Western Coastal Refinery", "type": "REFINERY", "country_id": "IND", "capacity": 1.5, "latitude": 19.0, "longitude": 72.8},
            {"id": "AST_EAST_COAST_REFINERY", "name": "Eastern Coastal Refinery", "type": "REFINERY", "country_id": "IND", "capacity": 0.8, "latitude": 17.6, "longitude": 83.2},
            {"id": "AST_LNG_TERMINAL", "name": "LNG Import Terminal", "type": "PORT", "country_id": "IND", "capacity": 0.5, "latitude": 21.0, "longitude": 72.0},
            {"id": "AST_STRATEGIC_STORAGE", "name": "Strategic Petroleum Reserve", "type": "STORAGE", "country_id": "IND", "capacity": 38.0, "latitude": 13.0, "longitude": 74.9}
        ]
        for a in assets_data:
            get_or_create(db, EnergyAsset, id=a["id"], defaults={"name": a["name"], "type": a["type"], "country_id": a["country_id"], "capacity": a["capacity"], "latitude": a["latitude"], "longitude": a["longitude"]})

        # 7. Trade Flows (using MERGE/get_or_create by supplier/commodity/route/destination)
        flows_data = [
            {"supplier_id": "SUP_GULF_CRUDE", "destination_country_id": "IND", "commodity_id": "CRUDE_OIL", "route_id": "RT_GULF_WEST_INDIA", "volume": 2.5},
            {"supplier_id": "SUP_RUSSIAN_CRUDE", "destination_country_id": "IND", "commodity_id": "CRUDE_OIL", "route_id": "RT_RUSSIA_INDIA_ENERGY", "volume": 1.8},
            {"supplier_id": "SUP_QATAR_LNG", "destination_country_id": "IND", "commodity_id": "LNG", "route_id": "RT_GULF_WEST_INDIA", "volume": 0.6},
            {"supplier_id": "SUP_UKRAINE_AGRI", "destination_country_id": "IND", "commodity_id": "SUNFLOWER_OIL", "route_id": "RT_BLACK_SEA_INDIA_AGRI", "volume": 0.15}
        ]
        for f in flows_data:
            get_or_create(db, TradeFlow, supplier_id=f["supplier_id"], destination_country_id=f["destination_country_id"], commodity_id=f["commodity_id"], route_id=f["route_id"], defaults={"volume": f["volume"]})

        # 8. Geopolitical Events (5 Scenarios)
        events_data = [
            {"source_event_id": "RISK_HORMUZ_2026", "title": "Strait of Hormuz Disruption", "description": "Escalation in the Strait of Hormuz disrupting maritime logistics.", "type": "ENERGY / MARITIME / GEOPOLITICAL", "location": "Strait of Hormuz", "severity": 0.9, "affected_entity_id": "CHK_HORMUZ", "confidence": 0.85},
            {"source_event_id": "RISK_REDSSEA_2026", "title": "Red Sea / Bab el-Mandeb Shipping Disruption", "description": "Threats forcing Cape reroutes for vessels.", "type": "MARITIME / LOGISTICS", "location": "Bab el-Mandeb", "severity": 0.75, "affected_entity_id": "CHK_BAB_EL_MANDEB", "confidence": 0.9},
            {"source_event_id": "RISK_RUSSIA_UKRAINE_AGRI_2026", "title": "Russia-Ukraine Agricultural Supply Disruption", "description": "Agricultural supply constraint affecting sunflower oil and fertilizer.", "type": "FOOD / AGRICULTURE", "location": "Black Sea", "severity": 0.7, "affected_entity_id": "RT_BLACK_SEA_INDIA_AGRI", "confidence": 0.8},
            {"source_event_id": "RISK_RUSSIAN_CRUDE_COMPETITION_2026", "title": "Russian Crude Supply Competition", "description": "Asian buyer competition squeezing Indian import allocation.", "type": "ENERGY / GEOPOLITICAL", "location": "Russia", "severity": 0.8, "affected_entity_id": "SUP_RUSSIAN_CRUDE", "confidence": 0.88},
            {"source_event_id": "RISK_TRANSSHIPMENT_2026", "title": "Indian Ocean Transshipment Congestion", "description": "Port congestion at Singapore and Colombo delaying supply chains.", "type": "LOGISTICS", "location": "Indian Ocean", "severity": 0.65, "affected_entity_id": "RT_SINGAPORE_INDIA", "confidence": 0.95}
        ]
        for e in events_data:
            defaults = {
                "title": e["title"], "description": e["description"], "type": e["type"], 
                "location": e["location"], "severity": e["severity"], "affected_entity_id": e["affected_entity_id"],
                "confidence": e["confidence"], "source_id": "GEAR-HACKATHON-INDIA-IMPORT-RISK-2026-08-20",
                "raw_payload": {"data_status": "SNAPSHOT"}
            }
            get_or_create(db, GeopoliticalEvent, source_event_id=e["source_event_id"], defaults=defaults)

        # 9. Risk Scores (Systemic + Entity Risks)
        risk_data = [
            {"entity_id": "SYSTEMIC_RISK", "score": 82.5, "level": RiskLevel.CRITICAL},
            {"entity_id": "CHK_HORMUZ", "score": 90.0, "level": RiskLevel.CRITICAL},
            {"entity_id": "CHK_BAB_EL_MANDEB", "score": 75.0, "level": RiskLevel.HIGH},
            {"entity_id": "IND", "score": 68.0, "level": RiskLevel.HIGH},
            {"entity_id": "RT_RUSSIA_INDIA_ENERGY", "score": 80.0, "level": RiskLevel.HIGH}
        ]
        
        # Clear existing snapshot scores to prevent compounding rows, since RiskScores are timeseries usually
        # But we only delete those from our model version.
        db.query(RiskScore).filter(RiskScore.model_version == "HACKATHON_SNAPSHOT_2026").delete()
        
        for r in risk_data:
            rs = RiskScore(
                entity_id=r["entity_id"],
                score=r["score"],
                level=r["level"],
                factors={"data_status": "SNAPSHOT", "volume_type": "MODEL_INPUT"},
                confidence=0.9,
                model_version="HACKATHON_SNAPSHOT_2026"
            )
            db.add(rs)

        db.commit()
        print("✅ Snapshot data successfully seeded into PostgreSQL.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_snapshot_seed()
