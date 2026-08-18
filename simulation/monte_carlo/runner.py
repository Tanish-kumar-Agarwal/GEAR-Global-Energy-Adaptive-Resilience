import numpy as np
from simulation.cascade.propagation import SupplyChainSimulator

def run_monte_carlo(baseline_flows, chokepoint_id: str, base_severity: float, iterations: int = 100):
    """
    Lightweight Monte Carlo Simulation.
    Samples severity around the base_severity using a normal distribution.
    Returns P10, P50, P90 of the total system supply gap.
    """
    gaps = []
    
    # Pre-build simulator for speed
    simulator = SupplyChainSimulator(baseline_flows)
    
    # Calculate initial total demand
    total_demand = sum(flow['volume'] for flow in baseline_flows)
    
    for _ in range(iterations):
        # Sample severity (mean = base, std = 0.15)
        sim_severity = np.random.normal(base_severity, 0.15)
        sim_severity = max(0.0, min(1.0, sim_severity)) # clamp between 0 and 1
        
        result = simulator.simulate_disruption(chokepoint_id, sim_severity)
        total_flow = result["total_flow"]
        gap = total_demand - total_flow
        gaps.append(max(0, gap))
        
    gaps = np.array(gaps)
    
    return {
        "p10_gap": round(np.percentile(gaps, 10), 2),
        "p50_gap": round(np.percentile(gaps, 50), 2),
        "p90_gap": round(np.percentile(gaps, 90), 2),
        "mean_gap": round(np.mean(gaps), 2),
        "iterations": iterations
    }
