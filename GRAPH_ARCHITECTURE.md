# GEAR - Graph Architecture

## Purpose
The Neo4j Knowledge Graph serves as the backbone of the **Global Digital Twin**. 

## Responsibilities
- **Multi-Commodity Interactions**: Modeling how Oil disruptions affect Fuel Prices → Transport Costs → Food Logistics. Or Gas Shortage → Electricity Supply → Coal Demand.
- **Global Coordination Engine**: Modeling strategic interdependence (e.g., India, Japan, EU competing for alternative supply).

## Folder Structure
```text
graph/
├── schema/
├── loaders/
├── queries/
└── algorithms/
```

## Outbox Synchronization
PostgreSQL remains the source of truth. Updates to the Digital Twin are propagated asynchronously to Neo4j to prevent distributed transaction deadlocks.
