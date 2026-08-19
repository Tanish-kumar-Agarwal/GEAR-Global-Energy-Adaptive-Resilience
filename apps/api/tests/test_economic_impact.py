from services.economic_impact_service import calculate_economic_impact

def test_economic_impact_basic():
    mc_results = {
        "uncertainty": {
            "p10": 2.0,
            "p50": 5.0,
            "p90": 10.0,
            "sample_count": 100
        }
    }
    
    result = calculate_economic_impact(mc_results, duration_days=10, commodity_price=80.0)
    
    assert result["status"] == "completed"
    assert result["impact"]["total"] == 4.0  # 5 * 80 * 10 / 1000 = 4.0
    assert result["impact"]["supply_shortage"] == 4.0
    assert result["impact"]["replacement_procurement"] == "data_unavailable"
    
    assert result["uncertainty"]["p10"] == 1.6
    assert result["uncertainty"]["p90"] == 8.0

def test_economic_impact_missing_price():
    mc_results = {
        "uncertainty": {
            "p10": 2.0,
            "p50": 5.0,
            "p90": 10.0,
            "sample_count": 100
        }
    }
    
    result = calculate_economic_impact(mc_results, duration_days=10, commodity_price=None)
    
    assert result["status"] == "insufficient_inputs"
    assert "commodity_price" in result["missing_inputs"]
    assert result["impact"]["total"] == "data_unavailable"

def test_economic_impact_missing_duration():
    mc_results = {
        "uncertainty": {
            "p10": 2.0,
            "p50": 5.0,
            "p90": 10.0,
            "sample_count": 100
        }
    }
    
    result = calculate_economic_impact(mc_results, duration_days=None, commodity_price=80.0)
    
    assert result["status"] == "insufficient_inputs"
    assert "duration" in result["missing_inputs"]
    assert result["impact"]["total"] == "data_unavailable"

def test_economic_impact_zero_gap():
    mc_results = {
        "uncertainty": {
            "p10": 0.0,
            "p50": 0.0,
            "p90": 0.0,
            "sample_count": 100
        }
    }
    
    result = calculate_economic_impact(mc_results, duration_days=10, commodity_price=80.0)
    
    assert result["status"] == "completed"
    assert result["impact"]["total"] == 0.0
