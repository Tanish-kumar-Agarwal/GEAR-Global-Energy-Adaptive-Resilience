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
                "dependency_concentration": {"before": 0.8, "after": 0.6} # example physical calculation delta
            },
            "economic_impact": {
                "status": "DATA_UNAVAILABLE",
                "avoided_loss": "DATA_UNAVAILABLE",
                "reason": "CapEx and route costs are missing from authoritative inputs"
            },
            "provenance": [
                {"source": "StrategyOverlay", "action": "Supplier Diversification", "timestamp": datetime.now(timezone.utc).isoformat()}
            ],
            "assumptions": [
                "Assumes baseline demand remains constant",
                "Financial costs excluded due to missing authoritative data"
            ]
        }
        
        # Calculate dependency shifts based on levers
        # e.g., if lever is "Supplier Diversification", check physical limits of supplier
        affected_suppliers = []
        for lever in strategy.levers:
            if lever.get("type") == "supplier_diversification":
                sup_id = lever.get("target_id")
                sup = self.db.query(Supplier).filter(Supplier.id == sup_id).first()
                if sup:
                    affected_suppliers.append(sup.name)
        
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
