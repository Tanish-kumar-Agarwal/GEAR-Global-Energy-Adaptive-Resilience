import uuid
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from models.domain import Job, JobStatus, StrategyScenario, Scenario, Supplier, Route, EnergyAsset
from datetime import datetime, timezone

class StrategyService:
    def __init__(self, db: Session):
        self.db = db

    def create_strategy(self, name: str, baseline_scenario_id: str, levers: List[Dict[str, Any]]) -> StrategyScenario:
        # Create a new isolated strategy scenario over the baseline
        strategy_id = uuid.uuid4()
        
        # Enqueue job
        job = Job(id=uuid.uuid4(), type="STRATEGY_EVALUATION", status=JobStatus.QUEUED)
        self.db.add(job)
        
        strategy = StrategyScenario(
            id=strategy_id,
            name=name,
            baseline_scenario_id=baseline_scenario_id,
            levers=levers,
            status=JobStatus.QUEUED,
            job_id=job.id
        )
        self.db.add(strategy)
        self.db.commit()
        return strategy

    def execute_strategy(self, strategy_id: str):
        strategy = self.db.query(StrategyScenario).filter(StrategyScenario.id == strategy_id).first()
        if not strategy:
            return

        job = self.db.query(Job).filter(Job.id == strategy.job_id).first()
        if job:
            job.status = JobStatus.RUNNING
            self.db.commit()

        # Execute strategy safely against graph without mutating baseline
        # (This is where the actual simulation runs via an overlay)
        # We will parse the levers and evaluate physically supported effects
        
        result = {
            "status": "completed",
            "strategy_id": str(strategy_id),
            "scenario_id": strategy.baseline_scenario_id,
            "resilience": {
                "supply_resilience": {"score": "DATA_UNAVAILABLE", "reason": "Requires full graph re-simulation"},
                "route_resilience": {"score": "DATA_UNAVAILABLE"},
                # Previously a hardcoded 0.8 -> 0.6 "example" that looked like a
                # real computation. Honest until the re-simulation exists.
                "dependency_concentration": {
                    "status": "DATA_UNAVAILABLE",
                    "reason": "Requires graph re-simulation; not yet computed",
                },
            },
            "economic_impact": {
                "status": "DATA_UNAVAILABLE",
                "avoided_loss": "DATA_UNAVAILABLE",
                "reason": "CapEx and route costs are missing from authoritative inputs"
            },
            "assumptions": [
                "Assumes baseline demand remains constant",
                "Financial costs excluded due to missing authoritative data"
            ]
        }

        # Levers arrive as free-form dicts from the UI, so be tolerant about
        # key and type spelling ("supplier-diversification", "Supplier
        # Diversification", target_id vs supplier_id) instead of silently
        # returning an empty list on any mismatch.
        def _lever_type(lever):
            raw = lever.get("type") or lever.get("lever") or ""
            return str(raw).strip().lower().replace("-", "_").replace(" ", "_")

        def _lever_target(lever):
            return lever.get("target_id") or lever.get("supplier_id") or lever.get("target")

        affected_suppliers = []
        provenance = []
        for lever in strategy.levers or []:
            lever_type = _lever_type(lever)
            target = _lever_target(lever)
            provenance.append({
                "source": "StrategyOverlay",
                "action": lever_type or "unknown_lever",
                "target": target,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            if lever_type == "supplier_diversification" and target:
                sup = self.db.query(Supplier).filter(Supplier.id == target).first()
                # Truthful even when the id is unknown: report what was targeted.
                affected_suppliers.append(sup.name if sup else str(target))

        result["provenance"] = provenance
        result["strategic_state"] = {
            "affected_suppliers": affected_suppliers
        }

        strategy.result = result
        strategy.status = JobStatus.COMPLETED
        if job:
            job.status = JobStatus.COMPLETED
            job.result = result
            
        self.db.commit()

    def get_strategy(self, strategy_id: str) -> Dict[str, Any]:
        strategy = self.db.query(StrategyScenario).filter(StrategyScenario.id == strategy_id).first()
        if not strategy:
            return None
        return {
            "id": str(strategy.id),
            "name": strategy.name,
            "baseline_scenario_id": strategy.baseline_scenario_id,
            "status": strategy.status.value if strategy.status else "UNKNOWN",
            "levers": strategy.levers,
            "result": strategy.result,
            "created_at": strategy.created_at.isoformat() if strategy.created_at else None
        }
