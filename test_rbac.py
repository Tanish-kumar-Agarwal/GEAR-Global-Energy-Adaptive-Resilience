import requests
import json

BASE_URL = "http://localhost:8000"

users = {
    "admin": "admin123",
    "decision_maker": "decision123",
    "operator": "operator123",
    "viewer": "viewer123"
}

def get_token(username, password):
    res = requests.post(f"{BASE_URL}/api/v1/auth/token", data={
        "username": username,
        "password": password
    })
    if res.status_code == 200:
        return res.json()["access_token"]
    raise Exception(f"Failed to get token for {username}: {res.text}")

def test_rbac():
    tokens = {}
    for user, pwd in users.items():
        tokens[user] = get_token(user, pwd)
        print(f"[{user}] Token acquired.")
        
    print("\n--- Testing GET /api/v1/decisions/pending (Requires decision:read) ---")
    for user, token in tokens.items():
        res = requests.get(f"{BASE_URL}/api/v1/decisions/pending", headers={"Authorization": f"Bearer {token}"})
        print(f"[{user}] Status: {res.status_code}")
        # Expected: All 200 except operator? Wait, Operator does not have decision:read in the matrix!
        
    print("\n--- Testing POST /api/v1/decisions/123e4567-e89b-12d3-a456-426614174000/approve (Requires decision:approve) ---")
    for user, token in tokens.items():
        res = requests.post(f"{BASE_URL}/api/v1/decisions/123e4567-e89b-12d3-a456-426614174000/approve", 
                            headers={"Authorization": f"Bearer {token}"},
                            json={"reason": "test"})
        print(f"[{user}] Status: {res.status_code}")
        
    print("\n--- Testing GET /api/v1/risks/evaluation (Requires risk:read) ---")
    for user, token in tokens.items():
        res = requests.get(f"{BASE_URL}/api/v1/risks/evaluation", headers={"Authorization": f"Bearer {token}"})
        print(f"[{user}] Status: {res.status_code}")

if __name__ == '__main__':
    test_rbac()
