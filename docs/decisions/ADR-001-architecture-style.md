# ADR-001: System Architecture Style & Multi-Tier Topology

## Status
Accepted

## Context
GEAR (Global Energy Adaptive Resilience) is a mission-critical decision intelligence platform engineered to assess global energy supply disruptions, trace topological cascade propagation across maritime chokepoints and energy grids, quantify economic and supply deficits, optimize multi-commodity procurement, and provide verifiable human-in-the-loop decision governance.

The platform requires high computational throughput for complex graph traversals and mathematical programming (OR-Tools optimization and Monte Carlo simulation), strict transactional consistency for decision auditing, and high-frequency reactive visualization on the client.

## Decision
We adopted a multi-tier, decoupled architecture with asynchronous execution pipelines:

1. **Frontend Presentation Tier**: Next.js 14 App Router (React 18, TypeScript, Tailwind CSS, Recharts) running with server/client component boundary isolation. Provides real-time interactive War Room, Scenario Simulation Lab, Strategy Sandbox, Decision Center, and Data Intelligence interfaces.
2. **Backend Application Tier**: Python FastAPI (Async ASGI) delivering high-performance, strictly-typed REST endpoints documented via OpenAPI/Swagger. Route handlers delegate orchestration to a dedicated service layer.
3. **Execution & Compute Tier**: Celery task workers with Redis broker backends (with an in-process eager fallback for headless testing and non-distributed execution). Long-running Monte Carlo iterations (10,000 runs) and OR-Tools MILP formulations run asynchronously with polling and event notifications.
4. **Data Persistence Tier**:
   - **PostgreSQL / SQLAlchemy**: Primary relational system of record, storing scenarios, simulation outcomes, mathematical optimization allocations, and immutable decision audit trails.
   - **Neo4j Property Graph**: Graph database modeling countries, suppliers, energy assets, maritime chokepoints, and shipping routes for blast radius and cascade path propagation.

## Consequences
- **Positive**: Clear separation of concerns, high concurrency handling without blocking the HTTP event loop, clean contract testing between frontend and backend.
- **Trade-offs**: Requires containerized service orchestration in production; headless unit test suites utilize SQLite StaticPool and eager task execution to eliminate external runtime dependencies.
