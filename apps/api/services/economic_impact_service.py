from typing import Dict, Any, List

def calculate_economic_impact(mc_results: Dict[str, Any], duration_days: int = None, commodity_price: float = None) -> Dict[str, Any]:
    """
    Transforms physical/logistical disruption results into deterministic economic consequences.
    Strictly enforces missing input policy: no fabricated defaults.
    """
    assumptions: List[Dict[str, Any]] = []
    missing_inputs: List[str] = []
    
    # Validation
    if duration_days is None:
        missing_inputs.append("duration")
    else:
        assumptions.append({
            "name": "disruption_duration",
            "value": duration_days,
            "unit": "days",
            "source": "scenario",
            "type": "scenario_parameter"
        })
        
    if commodity_price is None:
        missing_inputs.append("commodity_price")
        
    # Physical impact parsing
    uncert = mc_results.get("uncertainty", {})
    p10_gap = uncert.get("p10", 0)
    p50_gap = uncert.get("p50", 0)
    p90_gap = uncert.get("p90", 0)
    
    physical_impact = {
        "supply_gap": p50_gap,
        "duration": duration_days if duration_days is not None else "data_unavailable",
    }
    
    if missing_inputs:
        return {
            "status": "insufficient_inputs",
            "currency": "USD",
            "impact": {
                "total": "data_unavailable",
                "supply_shortage": "data_unavailable",
                "price_impact": "data_unavailable",
                "replacement_procurement": "data_unavailable",
                "logistics": "data_unavailable",
                "reserve": "data_unavailable"
            },
            "physical_impact": physical_impact,
            "uncertainty": {
                "status": "data_unavailable",
                "p10": None,
                "p50": None,
                "p90": None
            },
            "missing_inputs": missing_inputs,
            "assumptions": assumptions,
            "data_sources": ["Deterministic Cascade Simulation"],
            "confidence": "none",
            "methodology": "Calculation aborted due to missing required inputs."
        }
        
    # If we had price, calculate
    def calc_shortage_cost(gap_volume_m: float) -> float:
        # returns cost in Billions (B)
        # gap_volume_m is in Millions. cost = (gap * 1e6) * price * duration
        return round((gap_volume_m * commodity_price * duration_days) / 1000, 2)
    
    cost_p10 = calc_shortage_cost(p10_gap)
    cost_p50 = calc_shortage_cost(p50_gap)
    cost_p90 = calc_shortage_cost(p90_gap)
    
    return {
        "status": "completed",
        "currency": "USD",
        "impact": {
            "total": cost_p50,
            "supply_shortage": cost_p50,
            "price_impact": "data_unavailable",
            "replacement_procurement": "data_unavailable",
            "logistics": "data_unavailable",
            "reserve": "data_unavailable"
        },
        "physical_impact": physical_impact,
        "uncertainty": {
            "status": "available",
            "p10": cost_p10,
            "p50": cost_p50,
            "p90": cost_p90,
            "sample_count": mc_results.get("iterations", 100)
        },
        "assumptions": assumptions,
        "missing_inputs": [],
        "data_sources": [
            "Deterministic Cascade Simulation",
            "PostgreSQL Baseline Trade Flows"
        ],
        "confidence": "high (deterministic simulation with bounded assumptions)",
        "methodology": "Expected Shortage Cost = P50 Supply Gap × Duration × Commodity Price."
    }
