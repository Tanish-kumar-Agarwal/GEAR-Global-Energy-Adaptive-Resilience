# GEAR - Backend Architecture

## Stack
- **Framework**: Python FastAPI
- **Architecture**: Modular Monolith

## Request Flow
Next.js → FastAPI Route → Schema Validation → Service Layer → [ML/Graph/Simulation/Optimization] → Recommendation Engine → Schema → Next.js

## Backend Structure
```text
apps/api/
├── main.py
├── config.py
├── dependencies.py
│
├── routes/
│   ├── world.py, map.py, events.py, risks.py
│   ├── scenarios.py, optimization.py
│   └── recommendations.py, decisions.py
│
├── schemas/
│   └── (Pydantic models mapping 1:1 with routes)
│
├── services/
│   └── (Domain logic connecting routes to engines)
│
├── repositories/
│   └── (Data access layer for Postgres/Neo4j)
│
├── middleware/
│   └── logging.py, error_handler.py
│
└── workers/
    └── (Celery background tasks)
```

## Domain Integrations
Services act as orchestrators. For example, the `Scenario Service` fetches state from the `Digital Twin`, passes it to the `Cascade Engine`, runs `Monte Carlo`, optimizes via `Optimization`, explains via `Recommendation`, and returns the `Scenario Response`.
