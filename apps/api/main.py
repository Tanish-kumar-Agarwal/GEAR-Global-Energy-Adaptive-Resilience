from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import os
import sys

root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, root_dir)

app = FastAPI(
    title="GEAR API",
    description="Global Energy Adaptive Resilience Backend API",
    version="0.1.0"
)

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def root_health_check():
    return {"status": "ok", "service": "gear-api"}

from routes import world, scenarios, optimization

app.include_router(world.router)
app.include_router(scenarios.router)
app.include_router(optimization.router)

@app.get("/api/v1/health")
def api_v1_health_check():
    return {"status": "ok", "version": "v1"}
