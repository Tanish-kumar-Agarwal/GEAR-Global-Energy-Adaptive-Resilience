# Running GEAR locally (cold start)

Every command below is copy-pasteable from the repository root. Order matters.

## 0. Prerequisites

- Docker (Desktop or colima). If `docker compose` says `unknown shorthand flag: 'd'`,
  the compose v2 plugin is missing; use the standalone `docker-compose` binary instead.
- Python 3.12 (`brew install python@3.12`)
- Node 18+ for the web app

## 1. Environment file

`apps/api/main.py` loads `.env` from the repository root. The values must match
`infra/compose/docker-compose.yml`. In particular:

```
NEO4J_PASSWORD=gear_neo4j_pass   # NOT "password" - must match NEO4J_AUTH in compose
POSTGRES_DB=gear
POSTGRES_USER=gear_user
POSTGRES_PASSWORD=gear_pass
REDIS_URL=redis://localhost:6379/0
DEBUG=True
```

A wrong `NEO4J_PASSWORD` does not crash the API; every graph endpoint just
returns `{"status": "data_unavailable"}`. Check this first when the graph panels
are empty.

## 2. Infrastructure (Postgres, Neo4j, Redis)

```bash
cd infra/compose
docker-compose up -d        # or: docker compose up -d
docker ps                   # wait until postgres and neo4j report (healthy)
cd ../..
```

Ports: Postgres 5432, Neo4j 7474 (HTTP) / 7687 (Bolt), Redis 6379.
If a container exists but is Exited, `docker start compose-redis-1` (etc.) is enough.
Note: a Homebrew `redis-server` on 127.0.0.1:6379 will shadow the container for
local clients; either is fine as a Celery broker, just be aware which one you hit.

## 3. Python environment

```bash
python3.12 -m venv .venv
./.venv/bin/pip install -r apps/api/requirements.txt
```

## 4. Database schema and seed data

```bash
cd apps/api && ../../.venv/bin/python scripts/bootstrap_db.py && cd ../..   # idempotent schema
./.venv/bin/python db/seeds/demo_dataset.py                                # no-op if already seeded
```

Optional but recommended, so risk scores and prices are populated:

```bash
cd apps/api
../../.venv/bin/python scripts/ingest.py                 # risk scores from events
../../.venv/bin/python scripts/ingest_market_prices.py   # market price observations
cd ../..
```

## 5. Load the Neo4j digital twin

Neo4j is empty on first boot. An up container with no data still means every
graph endpoint returns `data_unavailable`.

```bash
./.venv/bin/python graph/loaders/digital_twin_loader.py
```

Warning: the loader starts with `MATCH (n) DETACH DELETE n` (full rebuild from
Postgres). Do not run it while someone is mid-demo.

## 6. API

```bash
cd apps/api
../../.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Login: `POST /api/v1/auth/token` (form-encoded `username=admin&password=admin123`).
With `DEBUG=True` most endpoints also work without a token.

## 7. Celery worker (required for scenario runs)

```bash
cd apps/api
../../.venv/bin/python -m celery -A workers.celery_app worker --loglevel=info --concurrency=2
```

Without a worker, `POST /scenarios/{id}/run` returns 202 and the job stays
QUEUED forever. To run a second API+worker pair against the same Redis without
the pairs stealing each other's jobs, give the pair its own queue:
`CELERY_TASK_QUEUE=gear_geo` on the API process, and
`CELERY_TASK_QUEUE=gear_geo ... worker -Q gear_geo` on the worker.

## 8. Web app

```bash
cd apps/web
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npx next dev -p 3000
```

## 9. Verify the stack (all must return real data, not data_unavailable)

```bash
curl -s localhost:8000/api/v1/health
curl -s localhost:8000/api/v1/world/routes            # 7 routes with path + chokepoint_ids
curl -s localhost:8000/api/v1/world/chokepoints       # 6 chokepoints with risk_score
curl -s localhost:8000/api/v1/risks/heatmap           # regions with scores
curl -s localhost:8000/api/v1/world/supply-chain-status
curl -s localhost:8000/api/v1/graph/critical-nodes    # body must contain nodes, 200 alone proves nothing
curl -s localhost:8000/api/v1/graph/dependencies/EnergyAsset/REF_JAMNAGAR
```

End-to-end scenario check (severity should change the impact numbers):

```bash
SID=$(curl -s -X POST localhost:8000/api/v1/scenarios -H 'Content-Type: application/json' \
  -d '{"name":"demo","target_id":"CHK_MALACCA","severity":0.9,"duration_days":30}' | jq -r .id)
curl -s -X POST localhost:8000/api/v1/scenarios/$SID/run
sleep 5
curl -s localhost:8000/api/v1/scenarios/$SID/results | jq '.results.impacted_routes, .results.impacted_chokepoints'
```

Scenario results include `impacted_routes` / `impacted_chokepoints`
(`status: stable | at_risk | disrupted`) for the map overlay. Impact stacks on
the live baseline risk, so a target that is already near-critical (Hormuz at
~92) saturates at 100 for any severity; use a low-baseline target like
CHK_MALACCA to see severity visibly move scores and flip statuses.
