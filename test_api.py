import sys
import os
root_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(root_dir, "apps/api"))

from fastapi.testclient import TestClient
from main import app
from core.database import SessionLocal
from models.domain import Scenario

client = TestClient(app)

db = SessionLocal()
scenarios = db.query(Scenario).all()
db.close()

if not scenarios:
    print("No scenarios found")
else:
    for sc in scenarios:
        if sc.job_id:
            scenario_id = str(sc.id)
            print(f"Testing Scenario {scenario_id}")
            resp = client.get(f"/api/v1/intelligence/explainability/scenario/{scenario_id}")
            print(f"Response: {resp.status_code}")
            if resp.status_code != 200:
                print(resp.json())
