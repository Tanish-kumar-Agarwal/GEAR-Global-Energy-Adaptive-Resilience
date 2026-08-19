import pytest
from optimization.procurement import optimize_procurement

def test_optimization_basic_feasibility():
    routes = [
        {"id": "RT_A", "capacity": 10.0, "destination_id": "DEST_1", "supplier_id": "SUP_1"},
        {"id": "RT_B", "capacity": 5.0, "destination_id": "DEST_1", "supplier_id": "SUP_2"}
    ]
    reserves = [
        {"id": "RES_1", "capacity": 150.0, "country_id": "DEST_1"}
    ]
    destinations = [
        {"id": "DEST_1", "demand": 20.0}
    ]
    duration_days = 30
    
    # Reserve max drawdown per day = 150 / 30 = 5.0
    # Total available supply per day = 10 (RT_A) + 5 (RT_B) + 5 (Reserve) = 20.0
    # Demand is 20.0, so shortage should be 0.0
    
    res = optimize_procurement(routes, reserves, destinations, duration_days)
    
    assert res["status"] == "completed"
    assert res["objective"]["shortage"] == 0.0
    
    alloc = res["allocation"]
    # Should max out routes and use reserve
    assert alloc["route_flows"]["RT_A"] == 10.0
    assert alloc["route_flows"]["RT_B"] == 5.0
    assert alloc["reserve_drawdowns"]["RES_1"] == 5.0
    
    recov = res["recovery"]
    assert recov["shortages"]["DEST_1"] == 0.0

def test_optimization_shortage_inevitable():
    routes = [
        {"id": "RT_A", "capacity": 5.0, "destination_id": "DEST_1", "supplier_id": "SUP_1"}
    ]
    reserves = []
    destinations = [
        {"id": "DEST_1", "demand": 10.0}
    ]
    
    # Available = 5, Demand = 10, Shortage = 5
    res = optimize_procurement(routes, reserves, destinations, 30)
    
    assert res["status"] == "completed"
    assert res["objective"]["shortage"] == 5.0
    assert res["allocation"]["route_flows"]["RT_A"] == 5.0
    assert res["recovery"]["shortages"]["DEST_1"] == 5.0

def test_optimization_diversification():
    routes = [
        {"id": "RT_1", "capacity": 10.0, "destination_id": "DEST_1", "supplier_id": "S1"},
        {"id": "RT_2", "capacity": 10.0, "destination_id": "DEST_1", "supplier_id": "S2"}
    ]
    reserves = []
    destinations = [{"id": "DEST_1", "demand": 15.0}]
    
    res = optimize_procurement(routes, reserves, destinations, 10)
    
    assert res["status"] == "completed"
    assert res["objective"]["shortage"] == 0.0
    assert res["resilience"]["diversification"]["utilized_route_count"] == 2
    assert res["resilience"]["diversification"]["utilized_reserve_count"] == 0
