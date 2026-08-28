# ADR-004: Mathematical Formulation for Multi-Commodity Procurement Optimization

## Status
Accepted

## Context
When energy chokepoints face severe capacity drops or total closures, energy security operators must determine how to allocate alternative supplies across international routes, storage drawdowns, and spot purchases to minimize net shortage and economic cost.

Heuristic or greedy algorithms fail to guarantee Pareto-optimal trade-offs between transport demurrage costs, strategic reserve depletion, and destination demand satisfaction.

## Decision
We selected **Google OR-Tools (Linear / Mixed-Integer Programming Solver)** as the core mathematical optimization engine in `optimization/procurement_optimizer.py`.

### Mathematical Formulation
1. **Decision Variables**:
   - $x_{s,d,r,c} \ge 0$: Volume of commodity $c$ procured from supplier $s$ shipped to destination $d$ via route $r$.
   - $y_{d,c} \ge 0$: Volume drawn from strategic reserve storage at destination $d$.
   - $s_{d,c} \ge 0$: Unmet supply shortage penalty variable at destination $d$.
2. **Objective Function**:
   $$\min \sum (C_{\text{procure}} + C_{\text{transport}}) x_{s,d,r,c} + \sum C_{\text{reserve}} y_{d,c} + \sum P_{\text{shortage}} s_{d,c} + \lambda \sum x_{s,d,r,c}^2$$
   *(where $P_{\text{shortage}} \gg C_{\text{procure}}$ ensures supply satisfaction is strictly prioritized over cost savings, and diversification regularizer $\lambda$ prevents over-concentration on a single supplier).*
3. **Constraints**:
   - **Supplier Capacity**: $\sum_{d,r} x_{s,d,r,c} \le \text{Cap}_{s,c}$
   - **Route Flow Capacity**: $\sum_{s,d,c} x_{s,d,r,c} \le \text{RouteCap}_r \times (1 - \text{DisruptionSeverity}_r)$
   - **Strategic Reserve Limits**: $y_{d,c} \le \text{MaxDrawdownRate}_{d,c}$
   - **Demand Balance**: $\sum_{s,r} x_{s,d,r,c} + y_{d,c} + s_{d,c} \ge \text{Demand}_{d,c}$

## Consequences
- **Positive**: Proven global optimality, instant resolution of complex multi-route constraints, realistic physical bottlenecks modeled explicitly.
- **Trade-offs**: Requires `ortools` native C++ bindings in Python runtime.
