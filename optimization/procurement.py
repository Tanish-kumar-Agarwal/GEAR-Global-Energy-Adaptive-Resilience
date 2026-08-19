from ortools.linear_solver import pywraplp

def optimize_procurement(routes, reserves, destinations, duration_days):
    """
    Optimizes recovery strategy to minimize physical supply shortage.
    Strictly uses physical constraints from the database schema (Route capacities, Reserve capacities).
    Does NOT fabricate financial costs, as they are not available in the authoritative Postgres schema.
    
    routes: list of dicts with 'id', 'capacity', 'destination_id', 'supplier_id'
    reserves: list of dicts with 'id', 'capacity', 'country_id'
    destinations: list of dicts with 'id', 'demand'
    duration_days: int (disruption duration, affects how much reserve can be drawn per day)
    """
    solver = pywraplp.Solver.CreateSolver('GLOP')
    if not solver:
        return {"status": "infeasible", "reason": "Solver failed to initialize."}

    # Variables: flow via route to destination
    flows = {}
    for r in routes:
        name = f"flow_{r['supplier_id']}_{r['destination_id']}_{r['id']}"
        # Constraint: Flow cannot exceed available route capacity
        flows[r['id']] = solver.NumVar(0, r['capacity'], name)

    # Variables: daily reserve drawdown at destination
    drawdowns = {}
    for res in reserves:
        name = f"drawdown_{res['country_id']}_{res['id']}"
        max_daily_drawdown = res['capacity'] / duration_days if duration_days > 0 else 0
        # Constraint: Daily drawdown cannot exceed available reserve capacity spread over duration
        drawdowns[res['id']] = solver.NumVar(0, max_daily_drawdown, name)

    # Variables: physical shortage at destination
    shortages = {}
    for d in destinations:
        name = f"shortage_{d['id']}"
        shortages[d['id']] = solver.NumVar(0, d['demand'], name)

    # Constraint: Demand satisfaction
    # sum(route flows to dest) + sum(reserve drawdowns at dest) + shortage = demand
    for d in destinations:
        dest_routes = [r['id'] for r in routes if r['destination_id'] == d['id']]
        dest_reserves = [res['id'] for res in reserves if res['country_id'] == d['id']]
        
        solver.Add(
            sum(flows[r_id] for r_id in dest_routes) +
            sum(drawdowns[res_id] for res_id in dest_reserves) +
            shortages[d['id']] == d['demand']
        )

    # Objective: Minimize total physical shortages
    objective = solver.Objective()
    
    for d in destinations:
        objective.SetCoefficient(shortages[d['id']], 1.0)
        
    objective.SetMinimization()
    
    status = solver.Solve()
    
    if status == pywraplp.Solver.OPTIMAL:
        optimal_flows = {r_id: flows[r_id].solution_value() for r_id in flows}
        optimal_drawdowns = {res_id: drawdowns[res_id].solution_value() for res_id in drawdowns}
        optimal_shortages = {d_id: shortages[d_id].solution_value() for d_id in shortages}
        
        # Calculate diversification (how many distinct routes/suppliers are utilized)
        utilized_routes = [r_id for r_id, val in optimal_flows.items() if val > 0.01]
        utilized_reserves = [res_id for res_id, val in optimal_drawdowns.items() if val > 0.01]
        
        return {
            "status": "completed",
            "objective": {
                "shortage": solver.Objective().Value(),
            },
            "allocation": {
                "route_flows": optimal_flows,
                "reserve_drawdowns": optimal_drawdowns
            },
            "recovery": {
                "shortages": optimal_shortages
            },
            "resilience": {
                "diversification": {
                    "utilized_route_count": len(utilized_routes),
                    "utilized_reserve_count": len(utilized_reserves)
                }
            }
        }
    else:
        return {
            "status": "infeasible",
            "reason": "Solver could not find a feasible recovery strategy.",
            "constraints": ["Demand satisfaction", "Route capacity", "Reserve capacity"]
        }
