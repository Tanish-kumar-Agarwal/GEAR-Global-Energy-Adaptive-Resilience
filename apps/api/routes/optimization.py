from fastapi import APIRouter
from optimization.procurement import optimize_procurement

router = APIRouter(prefix="/api/v1/optimization", tags=["Optimization"])

@router.post("/procurement")
def run_procurement_optimization():
    # Mock data based on the MVP dataset for immediate hackathon demonstration
    suppliers = [
        {"id": "SAU_ARAMCO", "capacity": 12.0, "cost": 75.0},
        {"id": "USA_EXXON", "capacity": 8.0, "cost": 85.0}
    ]
    routes = [
        {"id": "RT_HORMUZ_ASIA", "supplier_id": "SAU_ARAMCO", "destination_id": "IND", "capacity": 21.0, "cost": 2.0},
        {"id": "RT_US_ASIA", "supplier_id": "USA_EXXON", "destination_id": "IND", "capacity": 5.0, "cost": 5.0}
    ]
    destinations = [
        {"id": "IND", "demand": 5.0, "shortage_penalty": 200.0}
    ]
    
    result = optimize_procurement(suppliers, routes, destinations, demand=5.0)
    
    return {
        "status": result["status"],
        "recommendation": {
            "total_estimated_cost": result.get("total_cost", 0),
            "procurement_plan": result.get("flows", {}),
            "shortage_risk": result.get("shortages", {})
        }
    }
