import uuid
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from models.domain import Job, Scenario, DecisionAudit
from schemas.response import MasterResponseObject, ProblemContext, ImpactContext, OptionDetail, RecommendationContext
from services.explainability_service import ExplainabilityService

class ResponseOrchestratorService:
    def __init__(self, db: Session):
        self.db = db
        self.explainability_svc = ExplainabilityService(db)

    def _get_optimization_job(self, scenario_id: str) -> Job:
        return self.db.query(Job).filter(
            Job.type == "RECOVERY_OPTIMIZATION",
            Job.result.op("->>")("scenario_id") == str(scenario_id)
        ).order_by(Job.created_at.desc()).first()

    def get_master_response(self, scenario_id: str) -> MasterResponseObject:
        scenario_uuid = uuid.UUID(scenario_id)
        scenario = self.db.query(Scenario).filter(Scenario.id == scenario_uuid).first()
        if not scenario or not scenario.job_id:
            return self._empty_unavailable_response(scenario_id, "Scenario not found or not executed")

        scenario_job = self.db.query(Job).filter(Job.id == scenario.job_id).first()
        if not scenario_job or not scenario_job.result:
            return self._empty_unavailable_response(scenario_id, "Scenario simulation incomplete")

        # 1. Problem Context
        target = scenario.parameters.get("target_id", "Unknown")
        severity = scenario.parameters.get("severity", 0.0)
        duration = scenario.parameters.get("duration", 30)
        
        problem = ProblemContext(
            problem_id=str(scenario.id),
            scenario_id=str(scenario.id),
            target=target,
            severity=severity,
            duration_days=duration,
            status="ACTIVE"
        )

        # 2. Impact Context
        impact_data = scenario_job.result.get("impact", {})
        eco_data = scenario_job.result.get("economic_impact", {})
        cascade_data = scenario_job.result.get("cascade", {})
        uncertainty = scenario_job.result.get("uncertainty", {})

        eco_impact_total = eco_data.get("impact", {}).get("total", "data_unavailable")
        supply_gap = impact_data.get("supply_gap")
        
        impact = ImpactContext(
            supply_gap=supply_gap,
            economic_impact_total=eco_impact_total,
            p10_gap=uncertainty.get("P10", {}).get("supply_gap") if uncertainty else None,
            p50_gap=uncertainty.get("P50", {}).get("supply_gap") if uncertainty else None,
            p90_gap=uncertainty.get("P90", {}).get("supply_gap") if uncertainty else None,
            affected_routes=len(cascade_data.get("affected_routes", [])),
            affected_assets=len(cascade_data.get("affected_assets", [])),
            affected_countries=len(cascade_data.get("affected_countries", []))
        )

        # 3. Optimization and Options
        opt_job = self._get_optimization_job(str(scenario.id))
        
        options = []
        opt_result = {}
        rec_context = RecommendationContext(
            recommendation_id=str(uuid.uuid4()),
            action_type="Unknown",
            recommended_action="No Action",
            priority="LOW",
            expected_physical_impact={"shortage": supply_gap},
            expected_economic_impact={"loss": eco_impact_total},
            optimization_status="DATA_UNAVAILABLE",
            primary_drivers=[]
        )
        
        if opt_job and opt_job.result:
            opt_result = opt_job.result
            
            # Construct Option
            allocations = opt_result.get("allocations", [])
            has_routing = len(allocations) > 0
            has_reserve = opt_result.get("reserve_usage", {}).get("total_drawdown", 0) > 0
            
            if has_routing:
                options.append(OptionDetail(
                    option_id=f"opt_route_{opt_job.id}",
                    option_type="ROUTING",
                    name="Optimized Flow Routing",
                    description="Reallocate supply through alternative chokepoints and routes.",
                    feasibility="feasible",
                    expected_effect={"shortage_reduction": opt_result.get("objective", {}).get("improvement", 0)}
                ))
                
            if has_reserve:
                options.append(OptionDetail(
                    option_id=f"opt_reserve_{opt_job.id}",
                    option_type="RESERVES",
                    name="Strategic Reserve Drawdown",
                    description="Drawdown available strategic reserves to meet shortfall.",
                    feasibility="feasible",
                    expected_effect={"reserve_used": opt_result.get("reserve_usage", {}).get("total_drawdown", 0)}
                ))
                
            if has_routing or has_reserve:
                rec_context = RecommendationContext(
                    recommendation_id=str(opt_job.id),
                    action_type="HYBRID" if (has_routing and has_reserve) else ("ROUTING" if has_routing else "RESERVES"),
                    recommended_action="Execute Recommended Recovery Strategy",
                    priority="HIGH",
                    expected_physical_impact={"shortage": opt_result.get("objective", {}).get("optimized_shortage", supply_gap)},
                    expected_economic_impact={"avoided_loss": opt_result.get("avoided_loss", "data_unavailable")},
                    optimization_status="OPTIMIZED",
                    primary_drivers=[f"Target failure: {target}", f"Optimization feasibility constraint satisfied"]
                )
        
        # 4. Explainability
        explainability = self.explainability_svc.generate_scenario_explainability(str(scenario.id))
        
        exp_dict = {}
        alternatives = []
        assumptions = []
        provenance = []
        
        if explainability:
            exp_dict = {
                "causal_chain": [c.model_dump() for c in explainability.causal_chain],
                "evidence": [e.model_dump() for e in explainability.evidence],
                "methodology": explainability.methodology
            }
            alternatives = [a.model_dump() for a in explainability.alternatives]
            assumptions = [a.model_dump() for a in explainability.assumptions]
            provenance = [p.model_dump() for p in explainability.provenance]
            
            if opt_job and opt_job.result:
                rec_context.primary_drivers = explainability.primary_drivers
        
        # 5. Audit & Approval
        audit = self.db.query(DecisionAudit).filter(DecisionAudit.scenario_id == str(scenario.id)).order_by(DecisionAudit.timestamp.desc()).first()
        
        approval_status = "DRAFT"
        audit_dict = None
        if audit:
            approval_status = audit.status
            audit_dict = {
                "decision_id": str(audit.id),
                "status": audit.status,
                "timestamp": audit.timestamp.isoformat() if audit.timestamp else None,
                "action_plan": audit.action_plan
            }
            
        approval = {
            "status": approval_status,
            "requires_approval": True
        }

        return MasterResponseObject(
            status="SUCCESS",
            problem=problem,
            impact=impact,
            options=options,
            optimization=opt_result,
            recommendation=rec_context,
            explanation=exp_dict,
            approval=approval,
            alternatives=alternatives,
            uncertainty=uncertainty,
            assumptions=assumptions,
            provenance=provenance,
            decision_audit=audit_dict
        )

    def _empty_unavailable_response(self, scenario_id: str, reason: str) -> MasterResponseObject:
        return MasterResponseObject(
            status="DATA_UNAVAILABLE",
            problem=ProblemContext(problem_id="", scenario_id=scenario_id, target="", severity=0.0, duration_days=0, status=reason),
            impact=ImpactContext(supply_gap=None, economic_impact_total="data_unavailable", p10_gap=None, p50_gap=None, p90_gap=None, affected_routes=0, affected_assets=0, affected_countries=0),
            options=[],
            optimization={},
            recommendation=RecommendationContext(recommendation_id="", action_type="", recommended_action="", priority="", expected_physical_impact={}, expected_economic_impact={}, optimization_status="DATA_UNAVAILABLE", primary_drivers=[]),
            explanation={},
            approval={"status": "DATA_UNAVAILABLE"},
            alternatives=[],
            uncertainty={},
            assumptions=[],
            provenance=[]
        )
