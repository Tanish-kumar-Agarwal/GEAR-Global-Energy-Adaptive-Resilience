# GEAR - Simulation Architecture

## Scenario Engine & Cascade Simulator
The Simulation Architecture evaluates "What-if" disruptions.

### 1. Cascade Propagation Engine
A disruption doesn't stop at the first node.
Flow:
`Scenario → Network State → Node Failure → Capacity Reduction → Dependency Propagation → Alternative Flow → Shortage → Price/Economic Impact`

### 2. Black Swan Laboratory
A dedicated global stress-testing system.
- Generates scenarios
- Runs thousands of combinations
- Calculates probability, impact, and systemic risk
- Ranks output.

### 3. Folder Structure
```text
simulation/
├── network/ (network_model.py, flow_engine.py)
├── cascade/ (dependency.py, propagation.py)
└── monte_carlo/ (distributions.py, runner.py, analyzer.py)
```

## Forecasting Engine
Predicts future system conditions (P10, P50, P90 confidence intervals).
Outputs: Supply gaps, Price, Storage levels, Port congestion.
