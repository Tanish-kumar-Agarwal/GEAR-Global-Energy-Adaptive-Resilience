from .celery_app import celery_app
from core.database import SessionLocal
from models.domain import Job, JobStatus, TradeFlow, Route, EnergyAsset, DecisionAudit, Country, Scenario
from simulation.monte_carlo.runner import run_monte_carlo
import logging
from datetime import datetime, timezone
import uuid
import json

from core.logging import get_correlation_id, set_correlation_id

logger = logging.getLogger(__name__)

@celery_app.task(bind=True, name="tasks.execute_scenario_simulation")
def execute_scenario_simulation(self, job_id: str, target_id: str, severity: float, duration_days: int = 30):
    set_correlation_id(job_id)
    db = SessionLocal()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        db.close()
        return "Job not found"
        
    try:
        job.status = JobStatus.RUNNING
        db.commit()
        
        logger.info(f"Running Advanced Monte Carlo for job {job_id} at target {target_id} with severity {severity}")
        mc_results = run_monte_carlo(target_id, severity, duration_days, iterations=50, seed=42)
        
        from services.economic_impact_service import calculate_economic_impact
        economic_impact = calculate_economic_impact(mc_results, duration_days=duration_days, commodity_price=None)
        
        from graph.algorithms.scenario_overlay import generate_scenario_overlay
        scenario_overlay = generate_scenario_overlay(job_id, target_id, severity)
        
        job.result = {
            "cascade": mc_results["cascade"],
            "impact": mc_results["impact"],
            "resilience": mc_results["resilience"],
            "uncertainty": mc_results["uncertainty"],
            "assumptions": mc_results.get("assumptions", []),
            "data_sources": mc_results.get("data_sources", []),
            "methodology": mc_results.get("methodology", []),
            "economic_impact": economic_impact,
            "graph_overlay": scenario_overlay
        }
        job.status = JobStatus.COMPLETED
        db.commit()
        return "Success"
    except Exception as e:
        logger.error(f"Job {job_id} failed: {str(e)}")
        job.status = JobStatus.FAILED
        job.error = json.dumps({
            "status": "failed",
            "error": {
                "code": "TASK_EXECUTION_FAILED",
                "message": str(e),
                "component": "celery",
                "retryable": False,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "job_id": job_id
            }
        })
        db.commit()
        return f"Failed: {str(e)}"
    finally:
        db.close()


@celery_app.task(bind=True, name="tasks.execute_recovery_optimization")
def execute_recovery_optimization(self, optimization_job_id: str, scenario_job_id: str):
    set_correlation_id(optimization_job_id)
    db = SessionLocal()
    opt_job = db.query(Job).filter(Job.id == optimization_job_id).first()
    if not opt_job:
        db.close()
        return "Optimization Job not found"
        
    scenario_job = db.query(Job).filter(Job.id == scenario_job_id).first()
    if not scenario_job or not scenario_job.result:
        opt_job.status = JobStatus.FAILED
        opt_job.error = "Scenario Job not found or incomplete"
        db.commit()
        db.close()
        return "Scenario Job incomplete"

    try:
        opt_job.status = JobStatus.RUNNING
        db.commit()

        # 1. Load cascade result
        cascade = scenario_job.result.get("cascade", {})
        target_id = cascade.get("initial_disruption", {}).get("target")
        duration_days = cascade.get("initial_disruption", {}).get("duration_days", 30)
        baseline_impact = scenario_job.result.get("impact", {})
        baseline_economic = scenario_job.result.get("economic_impact", {})
        
        scenario = db.query(Scenario).filter(Scenario.job_id == scenario_job_id).first()
        actual_scenario_id = str(scenario.id) if scenario else scenario_job_id

        # 2. Extract active routes and reserves from DB
        db_routes = db.query(Route).all()
        # Find which destinations had demand based on TradeFlows
        flows = db.query(TradeFlow).all()
        dest_demands = {}
        for f in flows:
            dest_demands[f.destination_country_id] = dest_demands.get(f.destination_country_id, 0.0) + f.volume

        # Construct inputs for optimizer
        routes = [
            {"id": r.id, "capacity": r.capacity, "destination_id": "IND" if "ASIA" in r.id else "UNKNOWN", "supplier_id": "UNKNOWN"}
            for r in db_routes
        ] # We hack dest/supplier mapping temporarily if not perfectly modeled in routes
        
        # Proper mapping of tradeflows to find actual routes used by suppliers to dests
        route_map = {}
        for f in flows:
            route_map[f.route_id] = {"dest": f.destination_country_id, "sup": f.supplier_id}
            
        final_routes = []
        for r in db_routes:
            if r.id in route_map:
                final_routes.append({
                    "id": r.id,
                    "capacity": r.capacity,
                    "destination_id": route_map[r.id]["dest"],
                    "supplier_id": route_map[r.id]["sup"]
                })

        db_assets = db.query(EnergyAsset).filter(EnergyAsset.type == "STORAGE").all()
        reserves = [
            {"id": a.id, "capacity": a.capacity, "country_id": a.country_id}
            for a in db_assets
        ]

        destinations = [
            {"id": dest, "demand": dem}
            for dest, dem in dest_demands.items()
        ]

        # 3. Run optimizer. Imported here so optional native solver libraries do
        # not prevent the API or other background tasks from starting.
        from optimization.procurement import optimize_procurement
        opt_result = optimize_procurement(final_routes, reserves, destinations, duration_days)

        if opt_result["status"] != "completed":
            opt_job.result = opt_result
            opt_job.status = JobStatus.COMPLETED
            db.commit()
            return "Infeasible"

        # 4. Calculate Economic Impact of Optimized State
        # We construct a synthetic mc_results where p10, p50, p90 are all the optimized shortage
        opt_shortage = opt_result["objective"]["shortage"]
        synth_mc = {
            "uncertainty": {
                "p10": opt_shortage,
                "p50": opt_shortage,
                "p90": opt_shortage,
                "sample_count": 1
            }
        }
        
        from services.economic_impact_service import calculate_economic_impact
        opt_economic = calculate_economic_impact(synth_mc, duration_days=duration_days, commodity_price=None)
        
        # 5. Calculate Avoided Loss (if both are available)
        avoided_loss = "data_unavailable"
        if (baseline_economic.get("status") == "completed" and 
            opt_economic.get("status") == "completed"):
            base_total = baseline_economic.get("impact", {}).get("total", 0)
            opt_total = opt_economic.get("impact", {}).get("total", 0)
            if isinstance(base_total, (int, float)) and isinstance(opt_total, (int, float)):
                avoided_loss = round(base_total - opt_total, 2)
                
        # Calculate resilience improvement (shortage reduced)
        baseline_shortage = baseline_impact.get("supply_gap", 0)
        resilience_improvement = round(baseline_shortage - opt_shortage, 2)

        # 6. Build Final Result matching ResponseOrchestrator expectations
        opt_job.result = {
            "scenario_id": actual_scenario_id,
            "status": "completed",
            "strategy_id": str(uuid.uuid4()),
            "objective": {
                "baseline_shortage": round(baseline_shortage, 2),
                "optimized_shortage": round(opt_shortage, 2),
                "improvement": resilience_improvement
            },
            "allocations": opt_result["allocation"],
            "reserve_usage": opt_result["recovery"],
            "economic_impact": opt_economic,
            "resilience": opt_result["resilience"],
            "avoided_loss": avoided_loss,
            "constraints": ["Route capacities", "Reserve capacities", "Demand satisfaction"],
            "assumptions": ["Storage draws are linear over duration", "Full route capacity is accessible"],
            "provenance": ["PostgreSQL EnergyAsset", "PostgreSQL Route", "Phase 4.3 Cascade"],
            "methodology": "OR-Tools GLOP optimization minimizing physical unmet demand."
        }
        
        # 7. Create DecisionAudit
        audit = DecisionAudit(
            scenario_id=actual_scenario_id,
            recommendation_id=opt_job.id,
            status="OPTIMIZED",
            action_plan=opt_job.result,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(audit)
        
        opt_job.status = JobStatus.COMPLETED
        db.commit()
        return "Success"
    except Exception as e:
        logger.error(f"Optimization Job {optimization_job_id} failed: {str(e)}")
        opt_job.status = JobStatus.FAILED
        opt_job.error = json.dumps({
            "status": "failed",
            "error": {
                "code": "TASK_EXECUTION_FAILED",
                "message": str(e),
                "component": "celery",
                "retryable": False,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "job_id": optimization_job_id
            }
        })
        db.commit()
        return f"Failed: {str(e)}"
    finally:
        db.close()

@celery_app.task(name="run_strategy_pipeline")
def run_strategy_pipeline(strategy_id: str):
    set_correlation_id(strategy_id)
    logger.info(f"Starting Strategy Pipeline for strategy {strategy_id}")
    db = SessionLocal()
    try:
        from services.strategy_service import StrategyService
        svc = StrategyService(db)
        svc.execute_strategy(strategy_id)
        return "Success"
    except Exception as e:
        logger.error(f"Strategy {strategy_id} failed: {str(e)}")
        from models.domain import StrategyScenario, Job, JobStatus
        strategy = db.query(StrategyScenario).filter(StrategyScenario.id == strategy_id).first()
        if strategy:
            strategy.status = JobStatus.FAILED
            job = db.query(Job).filter(Job.id == strategy.job_id).first()
            if job:
                job.status = JobStatus.FAILED
                job.error = json.dumps({
                    "status": "failed",
                    "error": {
                        "code": "TASK_EXECUTION_FAILED",
                        "message": str(e),
                        "component": "celery",
                        "retryable": False,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "job_id": str(job.id)
                    }
                })
            db.commit()
        return f"Failed: {str(e)}"
    finally:
        db.close()
