# GEAR - Complete Repository Architecture

This is the exact repository architecture intended for implementation.

```text
gear/
├── apps/
│   ├── web/ (Next.js)
│   └── api/ (FastAPI)
│       ├── main.py, config.py, dependencies.py
│       ├── routes/, schemas/, services/, repositories/, middleware/, workers/
├── ml/
│   ├── nlp/, risk/, forecasting/, economic_impact/
├── graph/
│   ├── schema/, loaders/, queries/, algorithms/
├── simulation/
│   ├── network/, cascade/, monte_carlo/
├── optimization/
│   ├── procurement.py, routing.py, reserves.py, portfolio.py
├── data/
│   ├── ingestion/, cleaning/, normalization/, pipelines/
├── db/
│   ├── migrations/, schema/, seeds/
├── tests/
│   ├── unit/, integration/, simulation/, optimization/
├── infra/
│   ├── docker/, compose/
└── docs/
    ├── architecture/, api/, data/, models/, decisions/
```

## Infrastructure Topology
- **gear-frontend**: Next.js
- **gear-api**: FastAPI
- **gear-worker**: Celery/RQ
- **postgres**: Authoritative DB + pgvector + TimescaleDB
- **neo4j**: Digital Twin Graph DB
- **redis**: Cache & Broker
