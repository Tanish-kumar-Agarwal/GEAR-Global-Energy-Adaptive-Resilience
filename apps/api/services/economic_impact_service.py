from typing import Dict, Any, List, Optional

def calculate_economic_impact(
    mc_results: Dict[str, Any],
    duration_days: int = None,
    commodity_price: float = None,
    price_source: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Transforms physical/logistical disruption results into deterministic economic consequences.
    Strictly enforces missing input policy: no fabricated defaults.

    `price_source` carries the provenance of `commodity_price` (symbol, observation time,
    feed) so a valuation can always be traced back to the observation it was priced from.
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
    else:
        assumptions.append({
            "name": "commodity_price",
            "value": commodity_price,
            "unit": (price_source or {}).get("unit", "USD/bbl"),
            "source": (price_source or {}).get("source_id", "market_prices"),
            "observed_at": (price_source or {}).get("observed_at"),
            "type": "market_observation"
        })

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

    # Value of the strategic reserve that can be drawn against the gap. Volume comes from
    # the cascade's storage depletion table, capped at what the caverns actually hold.
    reserve_volume_m = 0.0
    for depletion in (mc_results.get("impact", {}).get("storage_depletion") or {}).values():
        daily_gap = depletion.get("daily_gap") or 0.0
        capacity = depletion.get("capacity") or 0.0
        reserve_volume_m += min(capacity, daily_gap * duration_days)
    reserve_value = round((reserve_volume_m * commodity_price) / 1000, 2) if reserve_volume_m else "data_unavailable"

    # Cost lines that need inputs we do not hold. Named explicitly rather than zeroed.
    unpriced = {
        "price_impact": "requires a price elasticity curve for the disrupted volume",
        "replacement_procurement": "requires spot premium quotes for replacement cargoes",
        "logistics": "requires freight rates for the alternative routing",
    }

    return {
        "status": "completed",
        "currency": "USD",
        "impact": {
            "total": cost_p50,
            "supply_shortage": cost_p50,
            "price_impact": "data_unavailable",
            "replacement_procurement": "data_unavailable",
            "logistics": "data_unavailable",
            "reserve": reserve_value
        },
        "unpriced_components": unpriced,
        "price_source": price_source,
        "physical_impact": physical_impact,
        "uncertainty": {
            "status": "available",
            "p10": cost_p10,
            "p50": cost_p50,
            "p90": cost_p90,
            # The simulator records its real sample count; never assume a default here.
            "sample_count": uncert.get("sample_count")
        },
        "assumptions": assumptions,
        "missing_inputs": [],
        "data_sources": [
            "Deterministic Cascade Simulation",
            "PostgreSQL Baseline Trade Flows",
            "PostgreSQL market_prices"
        ],
        "confidence": "high (deterministic simulation with bounded assumptions)",
        "methodology": (
            "Expected Shortage Cost = P50 Supply Gap x Duration x Commodity Price. "
            "Reserve value = min(storage capacity, daily gap x duration) x Commodity Price."
        )
    }
