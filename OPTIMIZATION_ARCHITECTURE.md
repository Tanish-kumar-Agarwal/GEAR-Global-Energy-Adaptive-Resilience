# GEAR - Optimization Architecture

## Adaptive Procurement Orchestrator
Instead of a simple "Buy from Supplier A", GEAR generates a blended portfolio:
- Supplier A → 35%
- Supplier B → 25%
- Domestic → 15%
- Reserve → 5%
With Expected Cost, Confidence, Risk, and Delivery Time attached.

## Strategic Reserve Optimization
Dynamically determines reserve release (Aggressive vs Moderate vs Preserve).
Inputs: Current Reserve, Expected Disruption Duration, Alternative Supply, Price Trajectory.

## Folder Structure
```text
optimization/
├── procurement.py
├── routing.py
├── reserves.py
└── portfolio.py
```

## Optimization Flow
`Scenario Results → Constraints → Decision Variables → Objective Function → OR-Tools/Solver → Optimal Strategy`

**Objective**: Minimize Procurement Cost, Transport Cost, Risk, Volatility. Maximize Energy Security and Flexibility.
