import numpy as np
from typing import Dict, Any
from simulation.cascade.engine import AdvancedCascadeEngine
from core.database import SessionLocal

def run_monte_carlo(target_id: str, base_severity: float, duration_days: int = 30, iterations: int = 50, seed: int = 42) -> Dict[str, Any]:
    """
    Advanced Monte Carlo Simulation using physical topological cascade.
    """
    # 1. Reproducibility
    np.random.seed(seed)
    
    # We will sample severity around the base severity (bounded 0.0 to 1.0)
    # And sample duration around base duration (+- 20%)
    severities = np.random.normal(base_severity, 0.1, iterations)
    severities = np.clip(severities, 0.0, 1.0)
    
    durations = np.random.normal(duration_days, duration_days * 0.2, iterations)
    durations = np.clip(durations, 1, 365).astype(int)
    
    gaps = []
    
    db = SessionLocal()
    try:
        engine = AdvancedCascadeEngine(db)
        # Store a baseline deterministic run for structural outputs
        baseline_result = engine.simulate(target_id, base_severity, duration_days)
        
        for i in range(iterations):
            # Run physical cascade per sample
            sim_severity = float(severities[i])
            sim_duration = int(durations[i])
            
            res = engine.simulate(target_id, sim_severity, sim_duration)
            gaps.append(res["impact"]["supply_gap"])
            
    finally:
        db.close()
        
    gaps_arr = np.array(gaps)
    
    # 2. Statistical Validity & Resilience output formatting
    # Embed the Monte Carlo bounds into the cascade result payload.
    
    mc_result = baseline_result
    mc_result["uncertainty"] = {
        "confidence": "probabilistic",
        "p10": round(float(np.percentile(gaps_arr, 10)), 2),
        "p50": round(float(np.percentile(gaps_arr, 50)), 2),
        "p90": round(float(np.percentile(gaps_arr, 90)), 2),
        "seed": seed,
        "sample_count": iterations,
        "distributions": [
            {"variable": "severity", "type": "normal", "mean": base_severity, "std": 0.1, "bounds": [0, 1]},
            {"variable": "duration", "type": "normal", "mean": duration_days, "std": round(duration_days*0.2, 1), "bounds": [1, 365]}
        ]
    }
    mc_result["assumptions"] = [
        "Monte Carlo executes full physical graph cascade per sample.",
        "Demand is assumed static over the duration for gap calculations."
    ]
    mc_result["data_sources"] = ["PostgreSQL Authoritative Capacities", "Neo4j Topological Dependencies"]
    mc_result["methodology"] = [
        "Graph traversal discovers N-hop downstream physical relationships.",
        "Supply gap is calculated natively by replacing baseline trade flows with disrupted capacities.",
        "P10/P50/P90 derived directly from discrete topological simulations."
    ]
    
    return mc_result
