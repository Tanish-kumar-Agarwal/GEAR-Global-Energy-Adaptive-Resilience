# UI Integration Audit (Phase 2.5)

## Overview
This document audits the five primary GEAR operating-mode UIs, identifying the current state of frontend-to-backend integration, identifying missing APIs, hard-coded data, and interaction gaps to be resolved in Phase 2.5.

### Note on Operating Modes
The Phase 2.5 brief lists: (1) War Room, (2) Scenario Lab, (3) Response Orchestrator, (4) Strategy Lab, (5) Decision Center. 
However, based on the previous Phase 2 visual reference implementation, the 5th tab was explicitly built as **"Data Intelligence (Source & Ingestion)"**. The human-decision/approval layer ("Decision Center" functionality) is currently embedded as the approval execution step at the bottom of the Response Orchestrator and Strategy Lab. We will audit the 5 existing functional pages.

---

## 1. Global War Room (`/war-room`)
*   **Existing Components**: TopNav, Sidebar, MapViewer, Risk Gauge, Key Metrics (Supply Gap, Active Threats, Impact), Regional Heatmap.
*   **Connection Status**: Partially Connected.
*   **Mock Data to Remove**:
    *   Hardcoded "Systemic Risk Score" components.
    *   Hardcoded "Active Threats" list.
    *   Hardcoded metrics in the right panel.
*   **Missing APIs**:
    *   `GET /api/v1/world/overview` (exists, needs expansion for real metrics).
    *   `GET /api/v1/world/events` (missing - need recent events).
*   **Missing States**: Loading spinners for data fetch, empty states for no active threats.

## 2. Scenario Lab (`/scenario-lab`)
*   **Existing Components**: Configuration Panel, MapViewer, Monte Carlo Probability Chart, Impact Metrics, Affected Volumes.
*   **Connection Status**: Partially Connected (currently statically triggers `POST /api/v1/scenarios/{id}/run` using hardcoded Hormuz ID).
*   **Mock Data to Remove**:
    *   Hardcoded API ID for Hormuz.
    *   The form state (Severity/Duration) does not dynamically pass to the backend currently; the backend uses a static dataset.
*   **Missing APIs**:
    *   Need an explicit WebSocket or polling loop to track the Job Status (QUEUED -> RUNNING -> COMPLETED).
    *   `GET /api/v1/scenarios/{id}/results` (exists, needs UI wiring).
*   **Missing States**: Job QUEUED/RUNNING progress bars. Form validation.

## 3. Response Orchestrator (`/response-orchestrator`)
*   **Existing Components**: Prioritized Action Plan, Recommended Strategy Radar Chart, Alternatives Table, Explainability Donut, Timeline, Bottom Approval Bar.
*   **Connection Status**: Partially Connected (calls `POST /api/v1/optimization/procurement` to generate routing cards).
*   **Mock Data to Remove**:
    *   Hardcoded data in the Radar Chart and Donut Chart (`[Requires API]`).
*   **Missing APIs**:
    *   `GET /api/v1/intelligence/explainability`
    *   `GET /api/v1/optimization/strategy-scores`
*   **Missing States**: The "Approve Recommended Plan" button needs to trigger a Decision creation (`POST /api/v1/decisions`), replacing the standalone Decision Center requirement.

## 4. Strategy Lab (`/strategy-lab`)
*   **Existing Components**: Multi-year Configurator, Investment Overview KPIs, Pillar Allocation Donut, Impact Line Chart, Initiatives Table.
*   **Connection Status**: Not Connected (UI layout only).
*   **Mock Data to Remove**:
    *   All charts and tables are currently mocked structural shells overlaid with `[Requires API]`.
*   **Missing APIs**:
    *   `POST /api/v1/strategy/plan`
    *   `GET /api/v1/strategy/investment-overview`
    *   `GET /api/v1/strategy/impact-projection`
*   **Missing States**: Loading simulation state.

## 5. Data Intelligence / Decision Center (`/data-intelligence`)
*   **Existing Components**: Source Management Table, Pipeline KPIs, Ingestion Volume Chart, Quality Gauge, Failure Breakdown.
*   **Connection Status**: Not Connected (UI layout only).
*   **Mock Data to Remove**:
    *   All system health charts are overlaid with `[Requires API]`.
*   **Missing APIs**:
    *   `GET /api/v1/system/pipeline-overview`
    *   `GET /api/v1/ingestion/sources`
*   **Missing States**: Live WebSocket/Polling heartbeat for system resources.

---

## Actionable Plan for Phase 2.5
1.  **Centralize API Client**: Create `apps/web/lib/api.ts` with typed fetch wrappers.
2.  **Define TypeScript Interfaces**: Create `apps/web/types/index.ts` matching Pydantic schemas.
3.  **Implement Job Polling**: Since true WebSockets require Redis/Daphne setup (which adds risk to hackathon), implement a robust React-Query or `setInterval` polling loop on `GET /api/v1/scenarios/{id}/results` mimicking WebSocket behavior.
4.  **Connect Pages 1-3 End-to-End**: Make the War Room -> Scenario Lab -> Response Orchestrator workflow fully dynamic using the Hormuz data.
5.  **Overlay Missing Pages (4 & 5)**: Leave Strategy Lab and Data Intelligence elegantly displaying their `[Requires API]` states, as their backend engines (5-year CapEx, Ingestion Telemetry) do not exist in the MVP and fabricating them violates Rule 11.
6.  **Create Decision Record Endpoint**: Implement `POST /api/v1/decisions` so the "Approve" button creates an auditable record.





