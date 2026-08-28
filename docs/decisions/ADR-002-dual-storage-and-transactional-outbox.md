# ADR-002: Dual Storage Topology & Transactional Outbox Pattern

## Status
Accepted

## Context
GEAR maintains both tabular transactional data (events, scenarios, optimization runs, human approval records) and rich property graph structures (multimodal supply chains, pipeline networks, maritime corridors, asset dependencies).

Directly synchronizing mutations across relational storage and graph databases in a single distributed 2PC transaction causes tight coupling, slow response times, and failure cascades if graph instances become momentarily unavailable.

## Decision
We implemented a Dual Storage model paired with the **Transactional Outbox Pattern**:

1. **Relational System of Record (PostgreSQL)**:
   - All incoming geopolitical events, scenario parameters, and optimization runs write synchronously to PostgreSQL within an ACID transaction.
   - Within the *same* database transaction, an event envelope is written to the `outbox` table (`payload`, `status='PENDING'`, `retry_count=0`, `created_at`).
2. **Asynchronous Projection Worker (`projection_worker.py`)**:
   - Background worker continuously polls pending outbox records.
   - Projections mutate the Neo4j graph topology (creating or updating `:GeopoliticalEvent`, `:EnergyAsset`, `:MaritimeRoute`, or `:Chokepoint` nodes and edges).
   - Upon successful graph mutation, the record is marked `PROCESSED`.
   - In case of transient graph disconnections, exponential backoff and `MAX_RETRIES` prevent infinite retry loops.

## Consequences
- **Positive**: PostgreSQL guarantees zero data loss and transactional isolation. Fast API responses without waiting for external graph writes.
- **Resilience**: If Neo4j is offline or restarting, incoming API requests complete cleanly in PostgreSQL; graph synchronizes automatically upon reconnect.
- **Trade-offs**: Graph read projections are eventually consistent (typically < 100ms lag).
