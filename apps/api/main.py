from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
import logging
import os
import sys
from dotenv import load_dotenv

root_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
sys.path.insert(0, root_dir)
load_dotenv(os.path.join(root_dir, ".env"))

from core.logging import setup_logging
setup_logging()

app = FastAPI(
    title="GEAR API",
    description="Global Energy Adaptive Resilience Backend API",
    version="0.1.0"
)

from core.database import engine, Base, SessionLocal
from models import domain
Base.metadata.create_all(bind=engine)

from middleware.request_context import RequestContextMiddleware
app.add_middleware(RequestContextMiddleware)

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logging.error(f"Database error during request {request.url}: {exc}")
    return JSONResponse(
        status_code=503,
        content={
            "status": "failed",
            "error_code": "DATABASE_UNAVAILABLE",
            "component": "postgresql",
            "message": "The authoritative database is unavailable or the transaction failed.",
            "retryable": True
        }
    )

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Seed Admin User
def seed_admin_user():
    db = SessionLocal()
    from core.security import get_password_hash
    if not db.query(domain.User).filter(domain.User.username == "admin").first():
        admin = domain.User(username="admin", hashed_password=get_password_hash("admin123"), role=domain.Role.ADMIN)
        db.add(admin)
        db.commit()
    
    # Also seed other test roles
    roles = [
        ("analyst", "analyst123", domain.Role.ANALYST),
        ("operator", "operator123", domain.Role.OPERATOR),
        ("decision_maker", "decision123", domain.Role.DECISION_MAKER),
        ("viewer", "viewer123", domain.Role.VIEWER)
    ]
    for username, password, role in roles:
        if not db.query(domain.User).filter(domain.User.username == username).first():
            user = domain.User(username=username, hashed_password=get_password_hash(password), role=role)
            db.add(user)
    db.commit()
    db.close()

@app.on_event("startup")
def startup_event():
    seed_admin_user()

@app.get("/health")
def root_health_check():
    return {"status": "ok", "service": "gear-api"}

@app.get("/api/v1/health/components")
def get_health_components():
    from sqlalchemy.sql import text
    import redis
    import importlib
    
    components = {}
    
    # Check PostgreSQL
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        components["postgresql"] = "healthy"
    except Exception as e:
        components["postgresql"] = "unavailable"
    finally:
        db.close()

    # Check Redis
    try:
        redis_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
        r = redis.from_url(redis_url, socket_timeout=1)
        r.ping()
        components["redis"] = "healthy"
    except Exception:
        components["redis"] = "unavailable"
        
    # Check Celery
    try:
        from workers.celery_app import celery_app
        # We try to ping celery workers but it can block, so we'll just check broker connection
        # A full ping would be celery_app.control.ping(timeout=1)
        res = celery_app.control.ping(timeout=0.5)
        components["celery"] = "healthy" if res else "degraded"
    except Exception:
        components["celery"] = "unavailable"

    # Check Neo4j
    try:
        from neo4j import GraphDatabase
        uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        user = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")
        driver = GraphDatabase.driver(uri, auth=(user, password))
        driver.verify_connectivity()
        components["neo4j"] = "healthy"
        driver.close()
    except Exception:
        components["neo4j"] = "unavailable"

    overall_status = "healthy"
    if "unavailable" in components.values():
        overall_status = "unhealthy"
    elif "degraded" in components.values():
        overall_status = "degraded"

    return {
        "status": overall_status,
        "components": components
    }

from routes import auth, world, intelligence, risks, scenarios, decisions, optimization, market, graph, response_routes, strategy

app.include_router(auth.router)
app.include_router(world.router)
app.include_router(intelligence.router)
app.include_router(risks.router)
app.include_router(scenarios.router)
app.include_router(decisions.router)
app.include_router(optimization.router)
app.include_router(market.router)
app.include_router(graph.router)
app.include_router(response_routes.router)
app.include_router(strategy.router)

@app.get("/api/v1/health")
def api_v1_health_check():
    return {"status": "ok", "version": "v1"}
