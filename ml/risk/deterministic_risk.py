from pydantic import BaseModel

class RiskResult(BaseModel):
    score: float
    level: str
    factors: dict
    confidence: float

def calculate_chokepoint_risk(base_risk_factor: float, geopolitical_severity: float, exposure_volume: float) -> RiskResult:
    """
    Deterministic risk model:
    base_risk_factor (0-1) * geopolitical_severity (0-1) * log(exposure_volume + 1)
    Normalized to 0-100
    """
    raw_score = (base_risk_factor + geopolitical_severity) * min(exposure_volume, 10.0) * 10
    score = min(max(raw_score, 0), 100)
    
    if score > 75:
        level = "CRITICAL"
    elif score > 50:
        level = "HIGH"
    elif score > 25:
        level = "MEDIUM"
    else:
        level = "LOW"
        
    return RiskResult(
        score=round(score, 2),
        level=level,
        factors={
            "base_risk": base_risk_factor,
            "geopolitical": geopolitical_severity,
            "exposure": exposure_volume
        },
        confidence=0.85
    )
