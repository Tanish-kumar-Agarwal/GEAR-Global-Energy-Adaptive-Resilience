# GEAR - Data Model

## Authoritative Data Ownership (Non-Negotiable)
- **PostgreSQL**: Authoritative transactional source of truth.
- **Neo4j**: Derived graph projection.
- **pgvector**: Derived embedding projection.
- **Redis**: Ephemeral infrastructure.

## Core Entities & Ownership
1. **Country**, **Supplier**, **Company**, **Commodity**, **EnergyAsset**, **Port**, **Refinery**, **StorageFacility**, **Route**, **Chokepoint**, **TradeFlow**:
   - *Storage*: PostgreSQL (Canonical) -> Neo4j (Derived Projection)
   - *Lifecycle Owner*: Data Intelligence / Ingestion Service
   - *Provenance*: Tracked via `source_id` and `timestamp`.
2. **GeopoliticalEvent**:
   - *Storage*: PostgreSQL -> pgvector (Embeddings)
   - *Lifecycle Owner*: Event Intelligence Service
3. **RiskScore**, **Forecast**:
   - *Storage*: PostgreSQL (TimescaleDB)
   - *Lifecycle Owner*: Risk Engine / Forecasting Engine
4. **Scenario**, **ScenarioResult**:
   - *Storage*: PostgreSQL (JSONB payload for results)
   - *Lifecycle Owner*: Scenario Engine (Never mutates baseline state).
5. **Recommendation**:
   - *Storage*: PostgreSQL
   - *Lifecycle Owner*: Recommendation Engine. MUST include `model_version`, `confidence`, and `evidence`.
6. **DecisionRecord**:
   - *Storage*: PostgreSQL (Append-only)
   - *Lifecycle Owner*: Decision Center. MUST include `actor`, `approval_status`, `timestamp`.
7. **DataSource**, **DataArtifact**, **Job**, **AuditEvent**, **FeedbackRecord**:
   - *Storage*: PostgreSQL (Audit logs are append-only).
   - *Lifecycle Owner*: System / Infrastructure / Workers.

## Outbox Pattern Schema
The Outbox table tracks state changes to be projected into Neo4j/pgvector.
- `event_id` (UUID)
- `aggregate_id` (String)
- `event_type` (String)
- `payload` (JSONB)
- `timestamp` (DateTime)
- `version` (Integer)
- `status` (Enum: QUEUED, RUNNING, COMPLETED, FAILED, DEAD_LETTER)
- `retry_count` (Integer)
- `idempotency_key` (String)
