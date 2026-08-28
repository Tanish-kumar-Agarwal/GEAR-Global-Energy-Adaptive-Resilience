# ADR-003: Deterministic Snapshot Support & Provenance Transparency

## Status
Accepted

## Context
GEAR secured Rank 1 in Phase 1 of the OOSC Hackathon based on a verified, realistic baseline snapshot of the global energy grid (Strait of Hormuz, Bab-el-Mandeb, Suez Canal, Malacca, North Sea pipelines). During Phase 2 productionization, live data connectors (AIS tracking, ACLED geopolitical feeds, commodity spot feeds) were designed.

A core engineering principle was established: **No Fake Functionality & No Fabricated Results**. Live data must never masquerade as static snapshot data, and snapshot data must never falsely claim to be live.

## Decision
We implemented a dual data mode with explicit provenance badging and fallback semantics:

1. **Configuration-Driven Operating Modes (`DATA_MODE`)**:
   - `snapshot`: Deterministic evaluation using calibrated global energy supply baselines.
   - `live`: Dynamic ingestion with real-time API integrations and periodic pollers.
2. **Explicit Provenance Badging in UI & API**:
   - Every metric, route disruption, and optimization result reports its data origin in the response envelope (`provenance: [{ source: '...', confidence: 0.95, timestamp: '...' }]`).
   - The UI displays explicit status chips: `[SNAPSHOT: DETERMINISTIC]`, `[LIVE INGESTION]`, or `[DATA UNAVAILABLE]`.
3. **Graceful Degradation (`DATA UNAVAILABLE` Semantics)**:
   - If an external live data provider fails or returns incomplete feeds, the platform displays `DATA UNAVAILABLE` with explicit error diagnostics rather than hallucinating plausible values.

## Consequences
- **Positive**: Complete auditability and scientific credibility for juries and enterprise energy analysts.
- **Trade-offs**: Requires explicit fallback handling in UI components and strict metadata tracking on all service payloads.
