import sys
import os
import time
import requests
from core.security import create_access_token
from datetime import timedelta

api_url = "http://127.0.0.1:8000"

def run_demo():
    print("Authenticating...")
    token = create_access_token({"sub": "admin", "role": "ADMIN"}, expires_delta=timedelta(minutes=60))
    headers = {"Authorization": f"Bearer {token}"}
    
    print("Executing Flagship Demo Scenario: Multi-Chokepoint Disruption")
    
    # 1. Create a Scenario based on HORMUZ disruption
    print("1. Creating scenario...")
    scen_payload = {
        "name": "India Energy Security — Multi-Chokepoint Disruption",
        "target_id": "CHK_HORMUZ",
        "severity": 0.95,
        "duration_days": 45
    }
    r = requests.post(f"{api_url}/api/v1/scenarios", json=scen_payload, headers=headers)
    if r.status_code != 200:
        print(f"Failed to create scenario: {r.text}")
        return
    
    scen = r.json()
    scen_id = scen["id"]
    print(f"Scenario {scen_id} created.")
    
    print("Running scenario...")
    r_run = requests.post(f"{api_url}/api/v1/scenarios/{scen_id}/run", headers=headers)
    if r_run.status_code not in [200, 202]:
        print(f"Failed to run scenario: {r_run.text}")
        return
    
    run_data = r_run.json()
    job_id = run_data["job_id"]
    print(f"Scenario running with Job {job_id}.")
    
    # Wait for scenario to finish
    print("Waiting for scenario to complete...")
    status = "QUEUED"
    while status in ["QUEUED", "RUNNING"]:
        time.sleep(2)
        r2 = requests.get(f"{api_url}/api/v1/scenarios/{scen_id}/results", headers=headers)
        data = r2.json()
        status = data.get("job_status", "FAILED")
        print(f"Status: {status}")
        if status == "FAILED":
            print("Scenario execution failed.")
            return

    print("Scenario execution completed.")

    # Generate Strategy Options
    print("2. Generating Strategy Options...")
    r = requests.post(f"{api_url}/api/v1/strategy/scenarios", json={
        "name": "Mitigate Hormuz and Red Sea",
        "baseline_scenario_id": scen_id,
        "levers": {
            "supplier_diversification": 0.5,
            "route_diversification": 0.5,
            "reserve_utilization": 0.8
        }
    }, headers=headers)
    
    if r.status_code != 200:
        print(f"Failed to generate strategy: {r.text}")
    else:
        strat = r.json()
        s_id = strat["strategy_scenario_id"]
        job_id2 = strat["job_id"]
        print(f"Strategy {s_id} created with Job {job_id2}.")
        
        status2 = "QUEUED"
        while status2 in ["QUEUED", "RUNNING"]:
            time.sleep(2)
            r2 = requests.get(f"{api_url}/api/v1/strategy/scenarios/{s_id}", headers=headers)
            if r2.status_code != 200:
                print("Error checking strategy:", r2.text)
                break
            data = r2.json()
            status2 = data.get("status", "FAILED")
            print(f"Strategy Status: {status2}")

    print("Demo backend execution finished.")

if __name__ == "__main__":
    run_demo()
