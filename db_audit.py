import os
import sys
import uuid
import json

root_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(root_dir, "apps/api"))

from core.database import SessionLocal
from models.domain import Scenario, Job, DecisionAudit

db = SessionLocal()

print("SCENARIOS:")
for sc in db.query(Scenario).all():
    print(f"- {sc.id}: {sc.name} (Job: {sc.job_id})")
    
print("\nJOBS:")
for j in db.query(Job).all():
    print(f"- {j.id}: {j.type} - {j.status}")
    if j.result:
        print(f"  Result Keys: {list(j.result.keys())}")
        
print("\nDECISION AUDITS:")
for da in db.query(DecisionAudit).all():
    print(f"- {da.id}: Scenario {da.scenario_id}")

db.close()
