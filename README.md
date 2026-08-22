# GEAR: Global Energy Adaptive Resilience

**A live model of the world's energy supply network. It tells you what breaks next when a shipping chokepoint closes, and what to do about it.**

## This is not hypothetical

Right now, in the real world:

- The Strait of Hormuz is running about **10 vessels a day** against a normal baseline of 88 to 130.
- About **20% of the world's oil** and **20% of its LNG** move through that one strait.
- The Red Sea route is at **49% of pre-crisis capacity**.
- The IEA calls the current situation **the largest supply disruption in the history of the oil market**.
- Global observed oil inventories fell **69 million barrels in July** alone.

(Sources: IEA Oil Market Report, US EIA.)

Governments and traders answer "what happens if Hormuz closes" with spreadsheets and guesswork. GEAR answers it with a dependency graph, a cascade simulation, and an optimizer. In milliseconds.

## What it does

Three screens, one workflow: monitor, simulate, plan.

### 1. War Room (monitor)

A live world map of 13 energy assets, 6 chokepoints, 7 shipping routes, and 13 trade flows. Every route has real coordinates. Right now it shows Hormuz at risk **91.8 (CRITICAL)** and Bab el-Mandeb at **73.9 (HIGH)**. The supply chain status is **DISRUPTED**: 7.8 of 10.25 million barrels per day at risk (76.1%), with 3 routes disrupted, 1 stressed, 3 nominal.

![War Room](docs/screenshots/war-room-live.png)

### 2. Scenario Lab (simulate)

Pick a chokepoint, set a severity, and watch the cascade. A preview responds in **6 to 9.5 ms**: Malacca at severity 0.3 scores 36.0 (stable), at 0.9 it scores 78.0 (disrupted). A full queued run does a Monte Carlo simulation over the dependency graph. A real Malacca run at severity 0.9 produced a supply gap of **4.68 out of a 5.2 Mb/d baseline**, with a P10/P50/P90 band of **3.94 / 4.56 / 5.12**, hitting the Hormuz-China and Hormuz-Japan routes, Japan and China as countries, and 4 suppliers.

![Scenario Lab](docs/screenshots/scenario-lab-live.png)

### 3. Strategy Lab (plan and invest)

The optimizer takes that 4.68 Mb/d gap and cuts it to **2.75 Mb/d**, an improvement of **1.93 Mb/d**. The financial layer then prices the strategy: at the default $12/bbl avoided-shortage premium, the plan shows an **NPV of $5.0B**, **34.2% annualised ROI**, and a **2.9 year payback**. Every one of those assumptions is on screen and editable. Change one and the numbers move.

![Strategy Lab](docs/screenshots/strategy-lab.jpg)

## Live demo

**https://gear-global-energy-adaptive-resilie.vercel.app**

Be aware: the deployed link runs on an **embedded snapshot dataset**, and it says so with a visible **DEMO DATA** marker in the header. It is a static build for judging convenience. The full live stack (Postgres, Neo4j, Redis, Celery, FastAPI) runs locally. See [Quickstart](#quickstart).

![Demo deploy with DEMO DATA marker](docs/screenshots/war-room-demo-deploy.jpg)

## Every number is honest

This is the part we are most proud of. **Every number on screen traces to a real computation, a live data source, or a stated assumption you can edit. Where there is no data, the interface says so instead of guessing.**

Concretely:

- **Four visually distinct data states.** Live data, awaiting a run, data unavailable (showing the backend's own reason), and not modeled. Red is reserved for real failures only. If the API is down, you see a red "SNAPSHOT DATA, API UNREACHABLE" banner, not silently stale numbers.
- **Financials are derived, not decorated.** NPV, ROI, and payback are computed from a visible assumptions block (discount rate, avoided-shortage premium, O&M cost, ramp-up time). Edit an assumption and the result recalculates on screen. Nothing is hardcoded.
- **The product states its own limits.** Two examples, shown in the UI itself: the optimizer does not close the supply gap to zero because China has no strategic storage in the dataset, and asset-type scenario targets return an empty cascade by model design. We label these instead of hiding them.

![Honest failure state](docs/screenshots/war-room-fallback-badge.png)

Most dashboards fake it when data is missing. GEAR does not. Judges can poke any number and find where it came from.

## How it works

```mermaid
flowchart LR
    subgraph Frontend
        WEB["Next.js 16 + React 19\nTailwind 4, MapLibre GL"]
    end
    subgraph Backend
        API["FastAPI\nSQLAlchemy + Alembic"]
        CEL["Celery workers"]
    end
    subgraph Data
        PG[("Postgres / TimescaleDB\ncapacities + time series")]
        NEO[("Neo4j\ndependency graph")]
        RED[("Redis\nqueue + cache")]
    end
    WEB --> API
    API --> PG
    API --> NEO
    API --> RED
    RED --> CEL
    CEL --> NEO
    CEL --> PG
```

- **Postgres (TimescaleDB)** holds the authoritative capacities and time series.
- **Neo4j** holds the digital twin: 60 nodes covering which routes pass through which chokepoints and which countries depend on which suppliers. This graph is what makes cascade analysis possible. The `/graph/critical-nodes` endpoint ranks Hormuz first, with **7.5 Mb/d of exposed volume and 9 dependent entities**.
- **Redis + Celery** run long scenario simulations asynchronously. If no worker is up, the API falls back to an inline synchronous run and labels it as such.
- **Monte Carlo over the graph cascade** produces the P10/P50/P90 uncertainty bands, so you get a range, not a false single number.
- **MapLibre GL** renders the map on a keyless CARTO basemap. No API keys needed to run it.

## Quickstart

Full cold-start runbook: [docs/RUNNING_LOCALLY.md](docs/RUNNING_LOCALLY.md). The short version:

```bash
# 1. Infrastructure: Postgres, Neo4j, Redis
cd infra/compose && docker-compose up -d && cd ../..

# 2. Python env
python3.12 -m venv .venv
./.venv/bin/pip install -r apps/api/requirements.txt

# 3. Schema + seed data
cd apps/api && ../../.venv/bin/python scripts/bootstrap_db.py && cd ../..
./.venv/bin/python db/seeds/demo_dataset.py

# 4. Load the Neo4j digital twin
./.venv/bin/python graph/loaders/digital_twin_loader.py

# 5. API
cd apps/api && ../../.venv/bin/python -m uvicorn main:app --port 8000

# 6. Celery worker (needed for scenario runs), in a second terminal
cd apps/api && ../../.venv/bin/python -m celery -A workers.celery_app worker --loglevel=info

# 7. Web app, in a third terminal
cd apps/web && npm install && NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 npx next dev -p 3000
```

Then open http://localhost:3000. Login is `admin` / `admin123`.

## Known limits

We would rather name these than have you find them:

- **The dataset is curated, not exhaustive.** 13 assets, 6 chokepoints, 7 routes, 13 trade flows. Enough to model the real Hormuz and Red Sea situation, not the whole planet.
- **The optimizer cannot reach zero gap.** China has no strategic storage in the dataset, so a residual gap remains. The UI says this.
- **Asset-type scenario targets return an empty cascade.** The cascade model is built around chokepoints and routes. Targeting an asset type is accepted but produces no downstream effects, by design.
- **The Vercel deploy is a snapshot.** It exists so judges can click around without installing Docker. The live stack is local only for now.
- **Financial outputs depend on their assumptions.** The $12/bbl avoided-shortage premium is a default, not a market quote. That is why it is editable and on screen.

## Repository layout

| Path | What it is |
|---|---|
| `apps/web` | Next.js frontend |
| `apps/api` | FastAPI backend |
| `graph/` | Neo4j loaders and graph services |
| `simulation/` | Cascade + Monte Carlo engine |
| `optimization/` | Supply reallocation optimizer |
| `db/` | Migrations and seed data |
| `infra/compose` | Docker compose for Postgres, Neo4j, Redis |
