"""
Disasters API Endpoints for GEAR.
Exposes live GDACS natural disaster feeds, GeoJSON layer outputs, and energy threat summaries.
"""

from fastapi import APIRouter, Query
from typing import Optional
from services.disaster_service import disaster_service

router = APIRouter()

@router.get("/live")
def get_live_disasters(force_refresh: bool = Query(False, description="Force re-fetch from GDACS API")):
    """
    Returns active global natural disasters parsed and normalized from GDACS GeoJSON.
    Includes Cyclones, Floods, Earthquakes, Wildfires, Volcanoes, and Tsunamis.
    """
    events = disaster_service.fetch_live_events(force_refresh=force_refresh)
    return {
        "status": "ok",
        "count": len(events),
        "data": events,
        "is_live": disaster_service._is_live_feed,
        "source": "GDACS (United Nations / European Commission)"
    }

@router.get("/geojson")
def get_disasters_geojson():
    """
    Returns live natural disaster events formatted as a standard GeoJSON FeatureCollection
    ready for direct consumption by MapLibre / Mapbox map instances.
    """
    return disaster_service.get_geojson()

@router.get("/summary")
def get_disasters_summary():
    """
    Returns high-level statistics: hazard counts by type, alert level distributions (Red/Orange/Green),
    and active natural hazard threats near critical maritime energy chokepoints.
    """
    return disaster_service.get_summary()

@router.get("/chokepoint-threats")
def get_chokepoint_disaster_threats():
    """
    Returns disasters situated within danger proximity of global maritime energy corridors.
    """
    events = disaster_service.fetch_live_events()
    threats = [e for e in events if len(e.get("threatened_chokepoints", [])) > 0]
    return {
        "status": "ok",
        "threat_count": len(threats),
        "threats": threats
    }
