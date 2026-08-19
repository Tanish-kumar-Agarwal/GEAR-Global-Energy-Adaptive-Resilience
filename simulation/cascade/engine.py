from typing import Dict, Any, List
from core.database import SessionLocal
from graph.neo4j_client import neo4j_client
from models.domain import TradeFlow, EnergyAsset, Route, Chokepoint, Supplier

class AdvancedCascadeEngine:
    def __init__(self, db_session):
        self.db = db_session

    def simulate(self, target_id: str, severity: float, duration_days: int) -> Dict[str, Any]:
        """
        Executes a deterministic cascade across the physical supply chain.
        """
        # 1. Resolve target and identify affected entities via Neo4j
        # We query for downstream TradeFlows originating from or passing through the target.
        query = """
        MATCH (target {id: $target_id})
        // Find downstream trade flows. The target could be a Chokepoint, Route, or Supplier
        OPTIONAL MATCH (target)<-[:PASSES_THROUGH|USES_ROUTE|EXPORTS_VIA*0..2]-(tf:TradeFlow)
        OPTIONAL MATCH (tf)-[:DESTINED_FOR]->(country:Country)
        
        RETURN 
            target.id AS target_id,
            collect(DISTINCT tf.id) AS affected_trade_flows,
            collect(DISTINCT country.id) AS affected_countries
        """
        res = neo4j_client.execute_read(query, target_id=target_id)
        
        if not res or not res[0].get("affected_trade_flows"):
            # Target not found or no downstream flows
            return self._empty_result(target_id, severity, duration_days)
            
        affected_tf_ids = res[0].get("affected_trade_flows", [])
        affected_countries = res[0].get("affected_countries", [])
        
        # We need to trace back which suppliers and routes are affected
        query_upstream = """
        MATCH (tf:TradeFlow) WHERE tf.id IN $tf_ids
        OPTIONAL MATCH (s:Supplier)-[:EXPORTS_VIA]->(tf)
        OPTIONAL MATCH (tf)-[:USES_ROUTE]->(r:Route)
        RETURN 
            collect(DISTINCT s.id) AS affected_suppliers,
            collect(DISTINCT r.id) AS affected_routes
        """
        up_res = neo4j_client.execute_read(query_upstream, tf_ids=affected_tf_ids)
        affected_suppliers = up_res[0].get("affected_suppliers", []) if up_res else []
        affected_routes = up_res[0].get("affected_routes", []) if up_res else []
        
        # 2. Fetch authoritative data from PostgreSQL
        flows = self.db.query(TradeFlow).all()
        assets = self.db.query(EnergyAsset).filter(EnergyAsset.type == "STORAGE").all()
        
        # 3. Calculate baseline vs effective
        # Baseline total supply to each country
        baseline_supply = {}
        effective_supply = {}
        
        for f in flows:
            dest = f.destination_country_id
            baseline_supply[dest] = baseline_supply.get(dest, 0.0) + f.volume
            
            # If flow is affected by disruption
            tf_id_str = str(f.id)
            if tf_id_str in affected_tf_ids:
                # Capacity reduction logic
                effective_volume = f.volume * (1.0 - severity)
            else:
                effective_volume = f.volume
                
            effective_supply[dest] = effective_supply.get(dest, 0.0) + effective_volume
            
        # 4. Supply Gaps & Storage Depletion
        supply_gaps = {}
        total_baseline = 0.0
        total_available = 0.0
        total_gap = 0.0
        
        storage_depletion = {}
        affected_assets = []
        
        for country in affected_countries:
            base = baseline_supply.get(country, 0.0)
            eff = effective_supply.get(country, 0.0)
            gap = base - eff
            
            total_baseline += base
            total_available += eff
            total_gap += gap
            
            supply_gaps[country] = gap
            
            if gap > 0:
                # Find storage for this country
                country_storage = [a for a in assets if a.country_id == country]
                if country_storage:
                    for store in country_storage:
                        affected_assets.append(store.id)
                        # Daily gap vs Storage Capacity
                        days_to_deplete = store.capacity / gap if gap > 0 else float('inf')
                        storage_depletion[store.id] = {
                            "capacity": store.capacity,
                            "daily_gap": gap,
                            "days_remaining": round(days_to_deplete, 1),
                            "depleted": days_to_deplete <= duration_days
                        }
        
        # 5. Resilience Metrics
        # Time to Impact: If storage exists, it's the days until depletion. Else, immediate (0).
        time_to_impact = min([d["days_remaining"] for d in storage_depletion.values()]) if storage_depletion else 0.0
        
        # Time to Recovery: purely based on duration for this MVP unless replacement supply kicks in
        time_to_recovery = duration_days 
        
        # Supply Resilience: Area under curve = available / baseline
        supply_resilience = total_available / total_baseline if total_baseline > 0 else 1.0
        
        # Reserve Resilience: Aggregate days remaining (simple min for MVP)
        reserve_resilience = time_to_impact if storage_depletion else None
        
        return {
            "status": "completed",
            "cascade": {
                "initial_disruption": {
                    "target": target_id,
                    "severity": severity,
                    "duration_days": duration_days
                },
                "affected_routes": affected_routes,
                "affected_suppliers": affected_suppliers,
                "affected_countries": affected_countries,
                "affected_assets": affected_assets,
                "affected_trade_flows": affected_tf_ids,
                "max_depth": 3
            },
            "impact": {
                "baseline_supply": round(total_baseline, 2),
                "available_supply": round(total_available, 2),
                "supply_gap": round(total_gap, 2),
                "storage_depletion": storage_depletion
            },
            "resilience": {
                "time_to_impact": time_to_impact,
                "time_to_recovery": time_to_recovery,
                "supply_resilience": round(supply_resilience, 2),
                "reserve_resilience": reserve_resilience,
                "route_resilience": None, # Future enhancement
                "diversification": None,
                "dependency_concentration": None,
                "recovery_gap": round(total_gap, 2)
            }
        }
        
    def _empty_result(self, target_id: str, severity: float, duration: int) -> Dict[str, Any]:
        return {
            "status": "completed",
            "cascade": {
                "initial_disruption": {"target": target_id, "severity": severity, "duration_days": duration},
                "affected_routes": [], "affected_suppliers": [], "affected_countries": [], "affected_assets": [], "affected_trade_flows": [],
                "max_depth": 3
            },
            "impact": {
                "baseline_supply": 0, "available_supply": 0, "supply_gap": 0, "storage_depletion": {}
            },
            "resilience": {
                "time_to_impact": None, "time_to_recovery": None, "supply_resilience": 1.0, "reserve_resilience": None,
                "route_resilience": None, "diversification": None, "dependency_concentration": None, "recovery_gap": 0
            }
        }
