from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
from core.security import RequirePermissions, User
import logging
from graph.queries import exposure
from graph.algorithms import centrality, blast_radius, systemic_risk, temporal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/graph", tags=["Graph Digital Twin"])

@router.get("/dependencies/{entity_type}/{entity_id}")
def get_dependencies(entity_type: str, entity_id: str, user: User = Depends(RequirePermissions("graph:read"))):
    """
    Returns upstream and downstream dependencies for a given entity type/id.
    """
    try:
        upstream = exposure.get_upstream_exposure(entity_type, entity_id)
        downstream = exposure.get_downstream_exposure(entity_type, entity_id)
        
        return {
            "entity": {"type": entity_type, "id": entity_id},
            "upstream_exposure": upstream,
            "downstream_exposure": downstream,
            "status": "completed"
        }
    except Exception as e:
        logger.error(f"Graph dependencies query failed: {e}")
        return {"status": "data_unavailable", "reason": "Graph projection unavailable or query failed."}

@router.get("/exposure/upstream/{entity_type}/{entity_id}")
def get_upstream(entity_type: str, entity_id: str, user: User = Depends(RequirePermissions("graph:read"))):
    try:
        data = exposure.get_upstream_exposure(entity_type, entity_id)
        return {"data": data, "status": "completed"}
    except Exception as e:
        logger.error(f"Upstream query failed: {e}")
        return {"status": "data_unavailable", "data": []}

@router.get("/exposure/downstream/{entity_type}/{entity_id}")
def get_downstream(entity_type: str, entity_id: str, user: User = Depends(RequirePermissions("graph:read"))):
    try:
        data = exposure.get_downstream_exposure(entity_type, entity_id)
        return {"data": data, "status": "completed"}
    except Exception as e:
        logger.error(f"Downstream query failed: {e}")
        return {"status": "data_unavailable", "data": []}

@router.get("/chokepoints/{chokepoint_id}/exposure")
def get_chokepoint_exposure(chokepoint_id: str, user: User = Depends(RequirePermissions("graph:read"))):
    try:
        data = exposure.get_downstream_exposure("Chokepoint", chokepoint_id)
        return {"data": data, "status": "completed"}
    except Exception as e:
        return {"status": "data_unavailable", "data": []}

@router.get("/critical-nodes")
def get_critical_nodes(user: User = Depends(RequirePermissions("graph:read"))):
    """
    Returns nodes ordered by their structural criticality.
    """
    try:
        data = centrality.calculate_structural_criticality()
        return {"data": data, "status": "completed"}
    except Exception as e:
        logger.error(f"Critical nodes query failed: {e}")
        return {"status": "data_unavailable", "data": []}

@router.get("/blast-radius/{entity_type}/{entity_id}")
def get_blast_radius(entity_type: str, entity_id: str, user: User = Depends(RequirePermissions("graph:read"))):
    """
    Calculates downstream blast radius up to 3 hops.
    """
    try:
        res = blast_radius.calculate_blast_radius(entity_type, entity_id)
        if res.get("status") == "error":
            return {"status": "data_unavailable", "reason": res.get("error")}
        return {"data": res, "status": "completed"}
    except Exception as e:
        return {"status": "data_unavailable"}

@router.get("/scenarios/{scenario_id}")
def get_scenario_graph(scenario_id: str, user: User = Depends(RequirePermissions("graph:read"))):
    """
    Returns the scenario graph overlay.
    Note: Currently the overlay is attached to Job result. We would fetch the Job here.
    """
    from core.database import SessionLocal
    from models.domain import Scenario, Job
    db = SessionLocal()
    try:
        scenario = db.query(Scenario).filter(Scenario.id == scenario_id).first()
        if not scenario or not scenario.job_id:
            return {"status": "data_unavailable", "reason": "Scenario not found or job missing."}
            
        job = db.query(Job).filter(Job.id == scenario.job_id).first()
        if not job or job.status.value != "COMPLETED" or not job.result:
            return {"status": "data_unavailable", "reason": "Scenario simulation pending or failed."}
            
        overlay = job.result.get("graph_overlay")
        if not overlay:
            return {"status": "data_unavailable", "reason": "No graph overlay found."}
            
        return {"data": overlay, "status": "completed"}
    except Exception as e:
        logger.error(f"Scenario graph query failed: {e}")
        return {"status": "data_unavailable"}
    finally:
        db.close()

@router.get("/systemic-risk/{entity_type}/{entity_id}")
def get_systemic_risk(entity_type: str, entity_id: str, user: User = Depends(RequirePermissions("graph:read"))):
    """
    Calculates deterministic structural Systemic Risk score based on graph topology.
    """
    try:
        res = systemic_risk.calculate_systemic_risk(entity_type, entity_id)
        if res.get("status") in ["data_unavailable", "error"]:
            return {"status": "data_unavailable", "reason": res.get("reason", "Graph data unavailable")}
        return res
    except Exception as e:
        logger.error(f"Systemic risk query failed: {e}")
        return {"status": "data_unavailable"}

@router.get("/temporal/events")
def get_temporal_events(start_time: str, end_time: str, user: User = Depends(RequirePermissions("graph:read"))):
    """
    Returns geopolitical events within a specific time window.
    """
    try:
        data = temporal.get_active_events(start_time, end_time)
        return {"data": data, "status": "completed"}
    except Exception as e:
        logger.error(f"Temporal events query failed: {e}")
        return {"status": "data_unavailable"}

@router.get("/temporal/exposure/{entity_type}/{entity_id}")
def get_temporal_exposure(entity_type: str, entity_id: str, start_time: str, end_time: str, user: User = Depends(RequirePermissions("graph:read"))):
    """
    Finds exposure for a specific entity driven strictly by events within a temporal window.
    """
    try:
        res = temporal.get_temporal_exposure(entity_type, entity_id, start_time, end_time)
        return res
    except Exception as e:
        logger.error(f"Temporal exposure query failed: {e}")
        return {"status": "data_unavailable"}
