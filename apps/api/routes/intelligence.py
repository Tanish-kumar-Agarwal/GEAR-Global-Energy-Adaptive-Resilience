from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
import json
import os
import re
from core.security import RequirePermissions, User
from sqlalchemy.orm import Session
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from core.database import get_db
from services.intelligence_service import IntelligenceService
from services.explainability_service import ExplainabilityService
from schemas.intelligence import (
    IntelligenceEventResponse, 
    IntelligenceEventListResponse,
    ExplainabilityResponse
)
from schemas.explainability import ScenarioExplainabilityResponse

router = APIRouter(prefix="/api/v1/intelligence", tags=["intelligence"])


def _get_json(url: str) -> dict | list:
    request = Request(url, headers={"User-Agent": "GEAR-Intelligence/1.0"})
    with urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def _get_text(url: str) -> str:
    request = Request(url, headers={"User-Agent": "GEAR-Intelligence/1.0"})
    with urlopen(request, timeout=12) as response:
        return response.read().decode("utf-8", errors="replace")


def _live_source(name: str, records: str, metric_value: int, detail: str) -> dict:
    return {
        "name": name,
        "status": "OK (Green)",
        "statusColor": "text-emerald-500",
        "sync": "Live fetch",
        "time": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "records": records,
        "metricValue": metric_value,
        "rel": "100%",
        "relColor": "bg-emerald-500",
        "detail": detail,
    }


def _failed_source(name: str, error: Exception) -> dict:
    return {
        "name": name,
        "status": "Error",
        "statusColor": "text-red-500",
        "sync": "Fetch failed",
        "time": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
        "records": "0",
        "metricValue": 0,
        "rel": "0%",
        "relColor": "bg-red-500",
        "detail": str(error)[:140],
    }


def _fetch_eia() -> dict:
    api_key = os.getenv("EIA_API_KEY")
    if not api_key:
        raise RuntimeError("EIA_API_KEY is not configured")
    query = urlencode({
        "api_key": api_key,
        "data[]": "price",
        "facets[sectorid][]": "RES",
        "facets[stateid][]": "US",
        "frequency": "monthly",
        "sort[0][column]": "period",
        "sort[0][direction]": "desc",
        "length": 1,
    })
    payload = _get_json(f"https://api.eia.gov/v2/electricity/retail-sales/data/?{query}")
    response = payload.get("response", {})
    row = (response.get("data") or [{}])[0]
    price = row.get("price", "n/a")
    period = row.get("period", "latest")
    total = int(response.get("total", 0))
    return _live_source("EIA", f"{total:,} series", total, f"US residential electricity price: {price} cents/kWh ({period})")


def _fetch_world_bank() -> dict:
    payload = _get_json("https://api.worldbank.org/v2/country/WLD/indicator/NY.GDP.MKTP.CD?format=json&per_page=1")
    row = (payload[1] if isinstance(payload, list) and len(payload) > 1 else [{}])[0]
    value = row.get("value")
    gdp = f"${value / 1_000_000_000_000:.2f}T" if isinstance(value, (int, float)) else "n/a"
    return _live_source("World Bank", "1 indicator", 1, f"World GDP: {gdp} ({row.get('date', 'latest')})")


def _fetch_gdelt() -> dict:
    query = urlencode({"query": "energy", "mode": "artlist", "format": "json", "maxrecords": 10, "timespan": "1day"})
    payload = _get_json(f"https://api.gdeltproject.org/api/v2/doc/doc?{query}")
    articles = payload.get("articles", [])
    title = articles[0].get("title", "No matching articles") if articles else "No matching articles"
    return _live_source("GDELT", f"{len(articles)} articles", len(articles), title)


def _fetch_open_meteo() -> dict:
    query = urlencode({
        "latitude": "26.0667",
        "longitude": "50.5577",
        "current": "temperature_2m,wind_speed_10m,precipitation",
    })
    payload = _get_json(f"https://api.open-meteo.com/v1/forecast?{query}")
    current = payload.get("current", {})
    temperature = current.get("temperature_2m", "n/a")
    wind = current.get("wind_speed_10m", "n/a")
    return _live_source("Open-Meteo", "1 current reading", 1, f"Persian Gulf: {temperature}°C, wind {wind} km/h")


def _fetch_gem() -> dict:
    page = _get_text("https://globalenergymonitor.org/projects/global-integrated-power-tracker/")
    match = re.search(r"most recent release of this data was in\s+([^.<]+)", page, re.IGNORECASE)
    release = match.group(1).strip() if match else "available"
    return _live_source("GEM", f"Release: {release}", 1, "Global Integrated Power Tracker")


@router.get("/data-sources")
def get_live_data_sources():
    """Fetch the live source summaries used by the Data Intelligence page."""
    fetchers = {
        "EIA": _fetch_eia,
        "World Bank": _fetch_world_bank,
        "GDELT": _fetch_gdelt,
        "Open-Meteo": _fetch_open_meteo,
        "GEM": _fetch_gem,
    }
    results = {}
    with ThreadPoolExecutor(max_workers=len(fetchers)) as executor:
        futures = {executor.submit(fetcher): name for name, fetcher in fetchers.items()}
        for future in as_completed(futures):
            name = futures[future]
            try:
                results[name] = future.result()
            except (HTTPError, URLError, TimeoutError, ValueError, RuntimeError) as error:
                results[name] = _failed_source(name, error)
            except Exception:
                results[name] = _failed_source(name, RuntimeError("Unexpected upstream response"))

    return {"sources": [results[name] for name in fetchers]}

@router.get("/events", response_model=IntelligenceEventListResponse)
def get_intelligence_events(
    skip: int = Query(0, description="Pagination skip"),
    limit: int = Query(50, description="Pagination limit"),
    db: Session = Depends(get_db)
):
    service = IntelligenceService(db)
    events, total = service.get_events(skip=skip, limit=limit)
    
    data = []
    for e in events:
        data.append(IntelligenceEventResponse(
            id=str(e.id),
            source_id=e.source_id,
            source_event_id=e.source_event_id,
            type=e.type,
            title=e.title,
            description=e.description,
            severity=e.severity,
            confidence=e.confidence,
            timestamp=e.timestamp,
            latitude=e.latitude,
            longitude=e.longitude,
            affected_entity_id=e.affected_entity_id,
            ingestion_time=e.ingestion_time,
            raw_payload=None # Do not expose raw payload in list view for size reasons
        ))
        
    return IntelligenceEventListResponse(data=data, total=total)

@router.get("/events/{event_id}", response_model=IntelligenceEventResponse)
def get_intelligence_event(event_id: str, db: Session = Depends(get_db)):
    service = IntelligenceService(db)
    e = service.get_event(event_id)
    if not e:
        raise HTTPException(status_code=404, detail="Event not found")
        
    return IntelligenceEventResponse(
        id=str(e.id),
        source_id=e.source_id,
        source_event_id=e.source_event_id,
        type=e.type,
        title=e.title,
        description=e.description,
        severity=e.severity,
        confidence=e.confidence,
        timestamp=e.timestamp,
        latitude=e.latitude,
        longitude=e.longitude,
        affected_entity_id=e.affected_entity_id,
        ingestion_time=e.ingestion_time,
        raw_payload=e.raw_payload
    )

@router.get("/explainability", response_model=ExplainabilityResponse)
def get_explainability(
    risk_id: str = Query(..., description="RiskScore ID to explain"),
    db: Session = Depends(get_db)
):
    service = IntelligenceService(db)
    explanation = service.get_explainability(risk_id)
    if not explanation:
        raise HTTPException(status_code=404, detail="Explanation could not be generated for this risk score")
        
    return explanation

@router.get("/explainability/scenario/{scenario_id}", response_model=ScenarioExplainabilityResponse)
def get_scenario_explainability(scenario_id: str, db: Session = Depends(get_db)):
    service = ExplainabilityService(db)
    explanation = service.generate_scenario_explainability(scenario_id)
    if not explanation:
        raise HTTPException(status_code=404, detail="Explainability data unavailable or scenario not found")
    return explanation
