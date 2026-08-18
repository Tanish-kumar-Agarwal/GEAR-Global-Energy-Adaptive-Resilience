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
