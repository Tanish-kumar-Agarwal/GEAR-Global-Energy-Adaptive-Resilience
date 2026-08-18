from ortools.linear_solver import pywraplp

def optimize_procurement(suppliers, routes, destinations, demand):
    """
    Optimizes procurement to minimize cost + shortage penalties.
    
    suppliers: list of dicts with 'id', 'capacity', 'cost'
    routes: list of dicts with 'id', 'capacity', 'supplier_id', 'destination_id', 'cost'
    destinations: list of dicts with 'id', 'demand', 'shortage_penalty'
    """
    solver = pywraplp.Solver.CreateSolver('GLOP')
    if not solver:
        return {"status": "Solver failed to initialize."}

    # Variables: flow from supplier via route to destination
    flows = {}
    for r in routes:
        name = f"flow_{r['supplier_id']}_{r['destination_id']}_{r['id']}"
        flows[r['id']] = solver.NumVar(0, r['capacity'], name)

    # Variables: shortage at destination
    shortages = {}
    for d in destinations:
        name = f"shortage_{d['id']}"
        shortages[d['id']] = solver.NumVar(0, d['demand'], name)

    # Constraint 1: Supplier capacities
    for s in suppliers:
        supplier_routes = [r['id'] for r in routes if r['supplier_id'] == s['id']]
        if supplier_routes:
            solver.Add(sum(flows[r_id] for r_id in supplier_routes) <= s['capacity'])

    # Constraint 2: Demand satisfaction
    for d in destinations:
        dest_routes = [r['id'] for r in routes if r['destination_id'] == d['id']]
        solver.Add(sum(flows[r_id] for r_id in dest_routes) + shortages[d['id']] == d['demand'])

    # Objective: Minimize total cost + shortage penalty
    objective = solver.Objective()
    
    # Add procurement + routing costs
    for r in routes:
        supplier = next(s for s in suppliers if s['id'] == r['supplier_id'])
        total_cost = supplier['cost'] + r['cost']
        objective.SetCoefficient(flows[r['id']], total_cost)
        
    # Add shortage penalties
    for d in destinations:
        objective.SetCoefficient(shortages[d['id']], d['shortage_penalty'])

    objective.SetMinimization()
    
    status = solver.Solve()
    
    if status == pywraplp.Solver.OPTIMAL:
        optimal_flows = {r_id: flows[r_id].solution_value() for r_id in flows}
        optimal_shortages = {d_id: shortages[d_id].solution_value() for d_id in shortages}
        return {
            "status": "OPTIMAL",
            "total_cost": solver.Objective().Value(),
            "flows": optimal_flows,
            "shortages": optimal_shortages
        }
    else:
        return {"status": "INFEASIBLE_OR_FAILED"}
