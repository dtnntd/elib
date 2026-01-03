import requests
import json

# Config
BASE_URL = "http://localhost:8081/api"
ADMIN_EMAIL = "admin@library.com"
ADMIN_PASS = "password123"

def test_stats():
    print("--- Testing Stats API ---")
    
    # Try Login, if fail then Register
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if res.status_code != 200:
        print("Login failed, attempting to register...")
        requests.post(f"{BASE_URL}/auth/register", json={
            "fullName": "Admin Test",
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS,
            "role": "ADMIN"
        })
        res = requests.post(f"{BASE_URL}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    
    if res.status_code != 200:
        print(f"Login still failed: {res.text}")
        return
        
    token = res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get Dashboard Stats
    print("\nGET /stats/dashboard")
    res = requests.get(f"{BASE_URL}/stats/dashboard", headers=headers)
    if res.status_code == 200:
        stats = res.json()
        print(json.dumps(stats, indent=2))
        assert "totalBooks" in stats
        assert "totalMembers" in stats
        assert "activeLoans" in stats
        print("✅ Dashboard Stats Structure OK")
    else:
        print(f"❌ Failed: {res.status_code} - {res.text}")

    # 2. Get Trends
    print("\nGET /stats/trends")
    res = requests.get(f"{BASE_URL}/stats/trends", headers=headers)
    if res.status_code == 200:
        trends = res.json()
        print(f"Trends Count: {len(trends)}")
        if len(trends) > 0:
            print(f"Sample Trend: {trends[0]}")
        print("✅ Trends API OK")
    else:
        print(f"❌ Failed: {res.status_code} - {res.text}")

if __name__ == "__main__":
    test_stats()
