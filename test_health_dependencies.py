import requests
import time
import os

def run_test():
    try:
        res = requests.get("http://localhost:8000/api/v1/health/components")
        print(f"Initial Health Status Code: {res.status_code}")
        print(res.json())
    except Exception as e:
        print(f"Failed to get initial health: {e}")

    print("Stopping Redis container...")
    os.system("docker stop compose-redis-1")
    time.sleep(3)

    try:
        res = requests.get("http://localhost:8000/api/v1/health/components")
        print(f"Health after stopping Redis Status Code: {res.status_code}")
        print(res.json())
    except Exception as e:
        print(f"Failed to get health after stopping redis: {e}")
        
    print("Starting Redis container...")
    os.system("docker start compose-redis-1")

run_test()
