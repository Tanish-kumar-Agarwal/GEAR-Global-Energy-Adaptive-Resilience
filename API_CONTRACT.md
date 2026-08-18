# GEAR - API Contract & WebSockets

## REST API Structure
Strictly structured around domains. Long-running tasks DO NOT block the HTTP response.

### Base Routes
- `GET /api/v1/world` (Baseline state)
- `GET /api/v1/map` (GeoJSON for map)
- `GET/POST /api/v1/events` 
- `GET /api/v1/risks`
- `GET /api/v1/recommendations`
- `GET/POST /api/v1/decisions`

### Job Management (Long-Running Tasks)
Simulation and Optimization operations return a Job ID immediately.
- `POST /api/v1/scenarios` → Returns `202 Accepted` with `{"job_id": "uuid"}`
- `POST /api/v1/optimization` → Returns `202 Accepted` with `{"job_id": "uuid"}`
- `GET /api/v1/jobs/{job_id}` → Returns Job Status (QUEUED, RUNNING, COMPLETED, FAILED)

## WebSocket Architecture
WebSockets are strictly for event streaming and progress updates. They DO NOT serve authoritative state payloads.
- **Channels**:
  - `/ws/v1/war-room` (Global event stream, risk updates)
  - `/ws/v1/jobs/{job_id}` (Progress updates: e.g., "Monte Carlo 45% complete")
- **Mechanism**: Fast API WS Endpoint subscribes to Redis Pub/Sub channels. Workers publish to Redis.
- **Backpressure**: Event throttling applied on the Redis publisher side.
