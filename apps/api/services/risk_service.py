from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
import sys
import os

from models.domain import RiskScore, GeopoliticalEvent, Country, EnergyAsset, Chokepoint
from schemas.risk import RiskTrendPoint, RiskExposureResponse, RiskExposureNode, RiskEvaluationResponse, EntityRiskDetail, EntityRiskResponse
from services import risk_taxonomy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
from graph.queries.digital_twin import (
    get_dependent_countries, 
    get_exposed_suppliers, 
    get_routes_through_chokepoint, 
    get_downstream_assets,
    get_geopolitical_events_affecting_node,
    get_risk_scores_for_node
)

class RiskService:
    def __init__(self, db: Session):
        self.db = db
        
    def get_trend(self, entity_id: Optional[str] = None, limit: int = 100) -> List[RiskTrendPoint]:
        query = self.db.query(RiskScore)
        if entity_id:
            query = query.filter(RiskScore.entity_id == entity_id)
            
        records = query.order_by(RiskScore.timestamp.asc()).limit(limit).all()
        
        # If no records exist, return empty, don't fabricate
        points = []
        for r in records:
            points.append(RiskTrendPoint(
                timestamp=r.timestamp,
                score=r.score,
                level=r.level,
                entity_id=r.entity_id
            ))
        return points
        
    def get_exposures(self, entity_id: str) -> RiskExposureResponse:
        # Fallback empty lists if Neo4j is offline or entity not found
        try:
            countries_res = get_dependent_countries(entity_id)
            countries = [RiskExposureNode(id=r["Country"], name=r.get("Name", r["Country"]), type="Country") for r in countries_res]
        except Exception:
            countries = []
            
        try:
            suppliers_res = get_exposed_suppliers(entity_id)
            suppliers = [RiskExposureNode(id=r["Supplier"], name=r.get("Name", r["Supplier"]), type="Supplier") for r in suppliers_res]
        except Exception:
            suppliers = []
            
        try:
            routes_res = get_routes_through_chokepoint(entity_id)
            routes = [RiskExposureNode(id=r["Route"], name=r.get("Name", r["Route"]), type="Route") for r in routes_res]
        except Exception:
            routes = []
            
        try:
            assets_res = get_downstream_assets(entity_id)
            assets = [RiskExposureNode(id=r["Asset"], name=r.get("Name", r["Asset"]), type="Asset") for r in assets_res]
        except Exception:
            assets = []
            
        return RiskExposureResponse(
            entity_id=entity_id,
            dependent_countries=countries,
            exposed_suppliers=suppliers,
            routes_affected=routes,
            downstream_assets=assets
        )
        
    def get_evaluation(self) -> RiskEvaluationResponse:
        # Aggregate from PostgreSQL
        avg_score = self.db.query(func.avg(RiskScore.score)).scalar() or 0.0
        critical_count = self.db.query(RiskScore).filter(RiskScore.level == "CRITICAL").count()
        high_count = self.db.query(RiskScore).filter(RiskScore.level == "HIGH").count()
        event_count = self.db.query(GeopoliticalEvent).count()
        
        highest_event = self.db.query(GeopoliticalEvent).order_by(GeopoliticalEvent.severity.desc()).first()
        highest_severity_title = highest_event.title if highest_event else None
        
        latest_risk = self.db.query(RiskScore).order_by(RiskScore.timestamp.desc()).first()
        latest_time = latest_risk.timestamp if latest_risk else None
        
        return RiskEvaluationResponse(
            systemic_risk_score=float(avg_score),
            active_critical_risks=critical_count,
            active_high_risks=high_count,
            affected_entities=critical_count + high_count, # Simplification
            affected_routes=0, # Graph aggregation could be done here if needed
            affected_chokepoints=0,
            affected_suppliers=0,
            event_count=event_count,
            highest_severity_event=highest_severity_title,
            latest_evaluation_timestamp=latest_time,
            status="ok"
        )
        
    def get_entity_risk(self, entity_id: str) -> Optional[EntityRiskResponse]:
        latest_risk = self.db.query(RiskScore).filter(RiskScore.entity_id == entity_id).order_by(RiskScore.timestamp.desc()).first()
        if not latest_risk:
            return None
            
        detail = EntityRiskDetail(
            entity_id=latest_risk.entity_id,
            latest_score=latest_risk.score,
            level=latest_risk.level,
            timestamp=latest_risk.timestamp
        )
        
        history = self.get_trend(entity_id=entity_id)
        active_events = self.db.query(GeopoliticalEvent).filter(GeopoliticalEvent.affected_entity_id == entity_id).all()
        
        exposures = self.get_exposures(entity_id=entity_id)
        
        return EntityRiskResponse(
            entity=detail,
            history=history,
            active_events=[{"title": e.title, "severity": e.severity} for e in active_events],
            exposures=exposures
        )

    # -----------------------------------------------------------------
    # CATEGORY BREAKDOWN
    # -----------------------------------------------------------------
    def get_categories(self, window_days: int = 30, trend_days: int = 7) -> Dict[str, Any]:
        """
        Category score = confidence-weighted mean of (severity x 100) across the events
        classified into that category inside the window. Trend compares the most recent
        `trend_days` against the `trend_days` before it.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        window_start = now - timedelta(days=window_days)

        events = (
            self.db.query(GeopoliticalEvent)
            .filter(GeopoliticalEvent.timestamp >= window_start)
            .all()
        )
        if not events:
            return {
                "status": "data_unavailable",
                "message": f"No events recorded in the last {window_days} days.",
            }

        buckets: Dict[str, List[GeopoliticalEvent]] = risk_taxonomy.empty_category_map()
        unclassified = 0
        for event in events:
            category = risk_taxonomy.classify(event.type, event.title, event.description)
            if category is None:
                unclassified += 1
                continue
            buckets[category].append(event)

        recent_cutoff = now - timedelta(days=trend_days)
        prior_cutoff = now - timedelta(days=trend_days * 2)

        categories = []
        for name, bucket in buckets.items():
            if not bucket:
                categories.append(
                    {
                        "category": name,
                        "label": risk_taxonomy.CATEGORY_LABELS[name],
                        "status": "data_unavailable",
                        "event_count": 0,
                    }
                )
                continue

            score = self._weighted_score(bucket)
            recent = [e for e in bucket if e.timestamp and e.timestamp >= recent_cutoff]
            prior = [e for e in bucket if e.timestamp and prior_cutoff <= e.timestamp < recent_cutoff]

            trend = "FLAT"
            delta = None
            if recent and prior:
                delta = round(self._weighted_score(recent) - self._weighted_score(prior), 1)
                if delta > 1.0:
                    trend = "UP"
                elif delta < -1.0:
                    trend = "DOWN"

            top = max(bucket, key=lambda e: (e.severity or 0.0))
            categories.append(
                {
                    "category": name,
                    "label": risk_taxonomy.CATEGORY_LABELS[name],
                    "status": "ok",
                    "score": score,
                    "level": self._level_for(score),
                    "trend": trend,
                    "delta": delta,
                    "event_count": len(bucket),
                    "top_event": top.title or top.type,
                    "matched_keywords": risk_taxonomy.matched_keywords(
                        name, top.type, top.title, top.description
                    )[:3],
                }
            )

        categories.sort(key=lambda c: c.get("score") or -1, reverse=True)
        return {
            "status": "ok",
            "window_days": window_days,
            "categories": categories,
            "unclassified_events": unclassified,
            "methodology": "score = sum(severity x confidence) / sum(confidence) x 100 over classified events in window",
            "provenance": ["PostgreSQL geopolitical_events", "services/risk_taxonomy.py keyword map"],
        }

    @staticmethod
    def _weighted_score(events: List[GeopoliticalEvent]) -> float:
        weight = sum(e.confidence or 1.0 for e in events)
        if weight <= 0:
            return 0.0
        total = sum((e.severity or 0.0) * (e.confidence or 1.0) for e in events)
        return round(min(total / weight * 100, 100.0), 1)

    @staticmethod
    def _level_for(score: float) -> str:
        if score >= 80:
            return "CRITICAL"
        if score >= 60:
            return "HIGH"
        if score >= 30:
            return "MEDIUM"
        return "LOW"

    # -----------------------------------------------------------------
    # REGIONAL HEATMAP
    # -----------------------------------------------------------------
    def get_heatmap(self) -> Dict[str, Any]:
        """
        Latest risk score per entity, rolled up to the region that entity sits in.
        Entities that cannot be resolved to a region are reported separately rather than
        being silently dropped from the totals.
        """
        latest_per_entity = self._latest_risk_per_entity()
        if not latest_per_entity:
            return {"status": "data_unavailable", "message": "No risk scores recorded."}

        countries = {c.id: c for c in self.db.query(Country).all()}
        assets = {a.id: a for a in self.db.query(EnergyAsset).all()}
        chokepoints = {c.id: c for c in self.db.query(Chokepoint).all()}

        regions: Dict[str, Dict[str, Any]] = {}
        unresolved = []

        for entity_id, risk in latest_per_entity.items():
            region, lat, lng, label = self._resolve_region(entity_id, countries, assets, chokepoints)
            if region is None:
                unresolved.append({"entity_id": entity_id, "score": round(risk.score, 1)})
                continue

            bucket = regions.setdefault(
                region,
                {"region": region, "scores": [], "entities": [], "lat": [], "lng": []},
            )
            bucket["scores"].append(risk.score)
            bucket["entities"].append(
                {"entity_id": entity_id, "name": label, "score": round(risk.score, 1)}
            )
            if lat is not None and lng is not None:
                bucket["lat"].append(lat)
                bucket["lng"].append(lng)

        results = []
        for region, bucket in regions.items():
            scores = bucket["scores"]
            peak = max(scores)
            results.append(
                {
                    "region": region,
                    "score": round(sum(scores) / len(scores), 1),
                    "peak_score": round(peak, 1),
                    "level": self._level_for(peak),
                    "entity_count": len(scores),
                    "entities": sorted(bucket["entities"], key=lambda e: e["score"], reverse=True),
                    "centroid": (
                        {
                            "lat": round(sum(bucket["lat"]) / len(bucket["lat"]), 3),
                            "lng": round(sum(bucket["lng"]) / len(bucket["lng"]), 3),
                        }
                        if bucket["lat"]
                        else None
                    ),
                }
            )

        results.sort(key=lambda r: r["peak_score"], reverse=True)
        return {
            "status": "ok",
            "regions": results,
            "unresolved_entities": unresolved,
            "methodology": "latest risk score per entity, averaged per region; level from the region's peak entity score",
            "provenance": [
                "PostgreSQL risk_scores",
                "PostgreSQL countries",
                "PostgreSQL energy_assets",
                "PostgreSQL chokepoints",
            ],
        }

    def _latest_risk_per_entity(self) -> Dict[str, RiskScore]:
        latest: Dict[str, RiskScore] = {}
        for risk in self.db.query(RiskScore).order_by(RiskScore.timestamp.asc()).all():
            if risk.entity_id:
                latest[risk.entity_id] = risk # later rows overwrite earlier ones
        return latest

    @staticmethod
    def _resolve_region(entity_id, countries, assets, chokepoints):
        """Resolve an entity id to (region, lat, lng, display name)."""
        if entity_id in countries:
            country = countries[entity_id]
            return country.region, None, None, country.name
        if entity_id in chokepoints:
            chokepoint = chokepoints[entity_id]
            return chokepoint.region, chokepoint.latitude, chokepoint.longitude, chokepoint.name
        if entity_id in assets:
            asset = assets[entity_id]
            country = countries.get(asset.country_id)
            return (
                country.region if country else None,
                asset.latitude,
                asset.longitude,
                asset.name,
            )
        return None, None, None, entity_id
