from sqlalchemy.orm import Session
from models.domain import Job, DecisionAudit, JobStatus
from schemas.explainability import (
    ScenarioExplainabilityResponse, RecommendationDetail, ExpectedImpact,
    CausalLink, EvidenceItem, AssumptionItem, ConfidenceDetail, ProvenanceDetail, AlternativeStrategy
)
import json

class ExplainabilityService:
    def __init__(self, db: Session):
        self.db = db
        
    def generate_scenario_explainability(self, scenario_job_id: str) -> ScenarioExplainabilityResponse:
        # 1. Fetch Scenario Job and Optimization Job
        import uuid
        scenario_job_uuid = uuid.UUID(scenario_job_id)
        scenario_job = self.db.query(Job).filter(Job.id == scenario_job_uuid).first()
        if not scenario_job or not scenario_job.result:
            return None # Scenario not found or not complete
            
        # 2. Fetch the latest DecisionAudit for this scenario
        audit = self.db.query(DecisionAudit).filter(DecisionAudit.scenario_id == scenario_job_id).order_by(DecisionAudit.timestamp.desc()).first()
        
        # 3. Extract Baseline Data
        baseline_impact = scenario_job.result.get("impact", {})
        baseline_economic = scenario_job.result.get("economic_impact", {})
        baseline_resilience = scenario_job.result.get("resilience", {})
        cascade = scenario_job.result.get("cascade", {})
        uncertainty = scenario_job.result.get("uncertainty", {})
        
        target = cascade.get("initial_disruption", {}).get("target", "Unknown")
        
        # 4. Extract Optimized Data (if available)
        opt_data = {}
        has_opt = False
        if audit and audit.action_plan and "optimization" in audit.action_plan:
            opt_data = audit.action_plan["optimization"]
            if opt_data.get("status") == "completed":
                has_opt = True
                
        # 5. Build Recommendation Detail
        if has_opt:
            rec = RecommendationDetail(
                status="available",
                strategy_id=opt_data.get("strategy_id"),
                strategy_name="Supply Network Optimization",
                objective="Minimize physical supply shortage across all impacted destinations.",
                reason="This strategy yields the lowest feasible unmet demand based on active route and storage reserve limits."
            )
        else:
            rec = RecommendationDetail(
                status="data_unavailable",
                strategy_id=None,
                strategy_name=None,
                objective=None,
                reason="Optimization result is unavailable or infeasible."
            )
            
        # 6. Build Expected Impact
        diff = {}
        if has_opt:
            diff = {
                "avoided_economic_loss": opt_data.get("avoided_loss"),
                "shortage_reduction": opt_data.get("objective", {}).get("improvement")
            }
            
        expected_impact = ExpectedImpact(
            baseline={
                "shortage": baseline_impact.get("supply_gap"),
                "economic_loss": baseline_economic.get("impact", {}).get("total", "data_unavailable")
            },
            recommended={
                "shortage": opt_data.get("objective", {}).get("optimized_shortage") if has_opt else "data_unavailable",
                "economic_loss": opt_data.get("economic_impact", {}).get("impact", {}).get("total", "data_unavailable") if has_opt else "data_unavailable"
            },
            difference=diff
        )
        
        # 7. Primary Drivers
        primary_drivers = [
            f"Chokepoint / Asset Disruption: {target}",
            f"Baseline Supply Gap: {baseline_impact.get('supply_gap', 0)} million barrels"
        ]
        
        # 8. Causal Chain
        causal_chain = [
            CausalLink(
                cause=f"Scenario severity on {target}",
                effect="Capacity reduction in physical topology",
                evidence={"cascade_start": target}
            ),
            CausalLink(
                cause="Capacity reduction in physical topology",
                effect="TradeFlow volume constraints",
                evidence={"downstream_nodes_impacted": True}
            ),
            CausalLink(
                cause="TradeFlow volume constraints",
                effect="Physical Supply Gap",
                evidence={"baseline_gap": baseline_impact.get("supply_gap", 0)}
            )
        ]
        if has_opt:
            causal_chain.append(
                CausalLink(
                    cause="Physical Supply Gap",
                    effect="Optimization re-routing & reserve drawdown",
                    evidence={"utilized_routes": opt_data.get("resilience", {}).get("diversification", {}).get("utilized_route_count", 0)}
                )
            )

        # 9. Evidence
        evidence = [
            EvidenceItem(
                source_type="PostgreSQL",
                entity="Job",
                entity_id=scenario_job_id,
                field="result.cascade",
                value=target,
                role="scenario_target"
            ),
            EvidenceItem(
                source_type="PostgreSQL",
                entity="Job",
                entity_id=scenario_job_id,
                field="result.impact.supply_gap",
                value=baseline_impact.get("supply_gap"),
                role="baseline_shortage"
            )
        ]

        # 10. Assumptions
        assumptions = [
            AssumptionItem(
                assumption="Linear Reserve Drawdown",
                value=True,
                reason="MVP models reserves drawn evenly across the disruption duration.",
                source="Phase 4.4 Optimizer"
            ),
            AssumptionItem(
                assumption="No Global Economic Substitution",
                value=True,
                reason="Economic impact calculates unmitigated direct losses based on physical shortages.",
                source="Phase 4.1 Economic Engine"
            )
        ]
        
        # 11. Alternatives
        alternatives = []
        if has_opt:
            alternatives.append(AlternativeStrategy(
                strategy="No Action (Baseline)",
                feasibility="feasible",
                objective_value={"shortage": baseline_impact.get("supply_gap")},
                shortage=baseline_impact.get("supply_gap")
            ))
            alternatives.append(AlternativeStrategy(
                strategy="Optimized Flow Routing",
                feasibility="feasible",
                objective_value={"shortage": opt_data.get("objective", {}).get("optimized_shortage")},
                shortage=opt_data.get("objective", {}).get("optimized_shortage")
            ))
            
        # 12. Confidence
        if uncertainty and uncertainty.get("sample_count", 0) > 1:
            confidence = ConfidenceDetail(
                level="statistical",
                basis=[
                    "Monte Carlo Simulation",
                    f"{uncertainty.get('sample_count')} valid iterations",
                    "P10/P50/P90 convergence"
                ]
            )
        else:
            confidence = ConfidenceDetail(
                level="deterministic",
                basis=[
                    "Authoritative PostgreSQL inputs",
                    "Deterministic topological cascade"
                ]
            )

        # 13. Provenance
        provenance = [
            ProvenanceDetail(
                input="Physical Capacity",
                source="PostgreSQL Database",
                entity="EnergyAsset / Route",
                calculation="Raw Data",
                engine="Authoritative Schema"
            ),
            ProvenanceDetail(
                input="Supply Gap",
                source="Phase 4.3 Engine",
                entity="AdvancedCascadeEngine",
                calculation="Graph Path Allocation",
                engine="NetworkX"
            )
        ]

        # Final Assembly
        return ScenarioExplainabilityResponse(
            scenario_id=scenario_job_id,
            recommendation=rec,
            expected_impact=expected_impact,
            primary_drivers=primary_drivers,
            causal_chain=causal_chain,
            evidence=evidence,
            assumptions=assumptions,
            uncertainty=uncertainty,
            alternatives=alternatives,
            limitations=["Financial procurement costs are data_unavailable.", "Market elasticity is excluded."],
            confidence=confidence,
            provenance=provenance,
            methodology="The system consumes the deterministic cascade, Monte Carlo uncertainty bounds, and authoritative OR-Tools constraints to trace causality from target failure to final mitigated output."
        )
