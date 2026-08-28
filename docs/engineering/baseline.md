# GEAR — Engineering Baseline Report

**Audit Date:** Phase 2 Discovery Baseline  
**Environment:** Windows PowerShell, Python 3.14.2 / Node.js 20+  
**Target:** GEAR (Global Energy Adaptive Resilience)

---

## 1. Test Baseline & Execution Status

| Test Module | Status | Category | Root Cause / Note |
|---|---|---|---|
| `apps/api/tests/test_simulation_advanced.py` | **PASSED** (2/2 tests) | Isolated / Mocked | Pure algorithmic test with mocked DB & Neo4j |
| `apps/api/tests/test_strategy.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | `main.py` executes top-level `create_all` & schema guard against PostgreSQL on import |
| `apps/api/tests/test_scenario_preview.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_scenario_geo_impact.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_route_geometry.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_optimization.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_e2e_pipeline.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_decision_center.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_economic_impact.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_explainability.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_gap_closure.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_graph_advanced.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_ingestion.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_intelligence_api.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_projection.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_response_orchestrator.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |
| `apps/api/tests/test_risks_api.py` | **FAILED** (Collection Timeout) | P0 Environment / Startup Issue | Blocked during `from main import app` |

---

## 2. Frontend Build & Static Analysis

| Check | Result | Details |
|---|---|---|
| TypeScript Type Check (`tsc --noEmit`) | **PASSED** (0 errors) | App builds cleanly, but has loose `: any` in several components |
| Dev Server Startup | **PASSED** | Web app runs cleanly on `http://localhost:3000` via webpack dev mode |
| Turbopack on Windows | **FLAKY / KNOWN CRASH** | Next 16 Turbopack SST cache corrupts on Windows, fixed by using `--webpack` |

---

## 3. Security & Authentication Audit Baseline

- **Authentication:** Inactive/Stand-alone (hardcoded bypass in `get_current_user`). Kept isolated from core demo path so it does not falsely claim production RBAC.
- **Secrets:** `.env` is properly gitignored; `.env.example` exists.
- **Data Integrity:** Honest data provenance architecture exists (`HACKATHON_SNAPSHOT`, `LIVE`, `FALLBACK`, `USER_INPUT`).

---

## 4. Remediation Priorities

1. **P0**: Separate database schema initialization from top-level module import in `main.py` (move to lifespan / startup handler). Support `DATABASE_URL` override in `core/database.py` for instant in-memory SQLite testing.
2. **P0**: Configure root `pytest.ini` and `conftest.py` with standard `PYTHONPATH`, mocked services, and test client fixtures so all unit/integration tests run in seconds without external network dependencies.
3. **P1**: Refactor API routes to thin handlers delegating to dedicated services.
4. **P1**: Replace loose `any` types in frontend with strongly typed interfaces.
5. **P1**: Add timeout & circuit-breaker resilience to external ingestion connectors (EIA, World Bank, GDELT).
