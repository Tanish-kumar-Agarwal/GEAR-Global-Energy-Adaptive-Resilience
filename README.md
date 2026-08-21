# GEAR — Global Energy Adaptive Resilience

## Overview
GEAR is an AI-powered global energy supply-chain resilience and decision-intelligence platform. It builds a living digital twin of the interconnected energy system to detect disruptions, simulate cascades, and optimize responses.

## Architecture
- **Frontend**: Next.js (App Router), Tailwind CSS, shadcn/ui, MapLibre GL
- **Backend**: FastAPI, Pydantic, SQLAlchemy, Celery
- **Databases**: PostgreSQL (Authoritative), Neo4j (Digital Twin), Redis (Cache/PubSub)
- **AI/Math**: NetworkX (Simulation), Google OR-Tools (Optimization), Scikit-Learn/XGBoost (Risk)

## Getting Started (Phase 1)

1. **Infrastructure**:
   ```bash
   docker-compose -f infra/compose/docker-compose.yml up -d
   ```

2. **Backend**:
   ```bash
   cd apps/api
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

3. **Frontend**:
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

## Security & environment variables

All configuration comes from a `.env` file in the repository root, which is
**gitignored and must never be committed**. To set one up:

```bash
cp .env.example .env   # then fill in real values
```

Required variables (see `.env.example` for details and local-dev defaults):
`POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`,
`POSTGRES_PORT`, `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`,
`CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `JWT_SECRET_KEY`, and
`EIA_API_KEY`. Optional: `CELERY_TASK_QUEUE`, `NEXT_PUBLIC_GEAR_DATA_MODE`.

> **Incident note:** a `.env` file containing real values for
> `POSTGRES_PASSWORD`, `NEO4J_PASSWORD`, `EIA_API_KEY`, and `JWT_SECRET_KEY`
> was previously committed to this public repository and remains in git
> history. Treat every one of those values as compromised: rotate the EIA API
> key, generate a new `JWT_SECRET_KEY`, and change any non-local database
> passwords. Removing the file from the current tree does not remove it from
> history.
