# GEAR - Database Architecture

## Data Layer Architecture
GEAR uses different storage systems optimized for specific intelligence and simulation purposes.

```text
                 DATA LAYER
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
     PostgreSQL               Neo4j
          │                     │
 Structured Data         Relationships
 Time-series             Dependencies
          │                     │
          └──────────┬──────────┘
                     ▼
                 Redis
                   Cache
```

## 1. PostgreSQL (Authoritative Source of Truth)
Handles: Countries, Assets, Ports, Routes, Trade Flows, Events, Risks, Scenarios, Recommendations, Decisions, Sources.
Uses TimescaleDB for time-series risk/forecast data, and pgvector for semantic search over unstructured event texts.

## 2. Neo4j (Derived Graph)
Handles: The connected Global Energy Digital Twin.
Nodes: Country, Supplier, Commodity, Port, Ship, Route, Chokepoint, Pipeline, Refinery, Power Plant, Storage, Event, Sanction.

## 3. Redis (Ephemeral)
Handles: Pure caching, Celery task queuing, and WebSocket pub/sub. NEVER authoritative.
