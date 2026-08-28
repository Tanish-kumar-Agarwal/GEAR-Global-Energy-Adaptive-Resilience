# ADR-007: Resilient Service Degradation & Offline Fallbacks

## Status
Accepted

## Context
In production deployments, external dependencies (such as Neo4j graph instances, Redis message brokers, or remote geospatial tile servers) may experience intermittent network partitions, maintenance windows, or service outages. The core decision intelligence platform must never crash or return unhandled 500 errors when ancillary services degrade.

## Decision
We established a strict **Resilient Degradation & Defensive Fallback Hierarchy**:

1. **Neo4j Graph Partition Fallback (`graph/neo4j_client.py`)**:
   - Connection timeout clamped to `2.0s`.
   - If Neo4j is offline, graph queries safely return structured `{ status: 'data_unavailable', blast_radius: null }` envelopes instead of raising uncaught socket exceptions.
2. **Celery Worker / Redis Partition Fallback (`apps/api/routes/scenarios.py`)**:
   - If Redis broker is unreachable, scenario simulations execute synchronously in-process via Celery eager evaluation (`.apply(args=[...])`), persisting results immediately into PostgreSQL.
3. **Database Engine Agnosticism (`apps/api/core/database.py`)**:
   - Production binds to PostgreSQL with connection pooling.
   - Headless unit testing automatically leverages in-memory SQLite with `StaticPool`, avoiding cross-thread file locking and enabling 100% self-contained CI testing.
4. **Transparent Client Degradation**:
   - Frontend components check for data availability tokens and render clear status badges (`DATA UNAVAILABLE: GRAPH OFFLINE`) while keeping the rest of the operational dashboard fully active.

## Consequences
- **Positive**: High uptime, zero fatal cascading crashes during infrastructure disruptions, fast and reliable continuous integration.
