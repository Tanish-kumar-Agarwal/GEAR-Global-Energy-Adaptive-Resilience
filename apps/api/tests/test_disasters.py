import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi.testclient import TestClient
from main import app
from services.disaster_service import disaster_service, haversine_distance_km

client = TestClient(app)

def test_haversine_distance_calculation():
    # Distance between London (51.5074, -0.1278) and Paris (48.8566, 2.3522) is approx 343 km
    dist = haversine_distance_km(51.5074, -0.1278, 48.8566, 2.3522)
    assert 340.0 <= dist <= 350.0

def test_get_live_disasters_endpoint():
    response = client.get("/api/v1/disasters/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "count" in data
    assert isinstance(data["data"], list)
    assert len(data["data"]) > 0
    
    first_event = data["data"][0]
    assert "id" in first_event
    assert "event_type" in first_event
    assert "lat" in first_event
    assert "lng" in first_event
    assert "alert_level" in first_event
    assert first_event["alert_level"] in ["Red", "Orange", "Green"]

def test_get_disasters_geojson_endpoint():
    response = client.get("/api/v1/disasters/geojson")
    assert response.status_code == 200
    geojson = response.json()
    assert geojson["type"] == "FeatureCollection"
    assert "features" in geojson
    assert "metadata" in geojson
    assert len(geojson["features"]) > 0
    
    first_feat = geojson["features"][0]
    assert first_feat["type"] == "Feature"
    assert first_feat["geometry"]["type"] == "Point"
    assert len(first_feat["geometry"]["coordinates"]) == 2

def test_get_disasters_summary_endpoint():
    response = client.get("/api/v1/disasters/summary")
    assert response.status_code == 200
    summary = response.json()
    assert summary["status"] == "ok"
    assert "total_active_disasters" in summary
    assert "counts_by_type" in summary
    assert "counts_by_alert_level" in summary
    assert "provenance" in summary
    assert summary["provenance"]["authority"] == "United Nations / European Commission Joint Research Centre"

def test_get_chokepoint_disaster_threats():
    response = client.get("/api/v1/disasters/chokepoint-threats")
    assert response.status_code == 200
    threats_data = response.json()
    assert threats_data["status"] == "ok"
    assert "threat_count" in threats_data
    assert isinstance(threats_data["threats"], list)
