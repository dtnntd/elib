import requests
from pymongo import MongoClient

# Config
BASE_URL = "http://localhost:8080/api"
MONGO_URI = "mongodb://localhost:27017"

# Setup DB
client = MongoClient(MONGO_URI)
db = client["elibrary_db"]

def debug_wallet_access():
    print("--- Debugging Wallet Access for MEMBER ---")
    
    # 1. Create a MEMBER user
    email = "testmember@example.com"
    password = "password123"
    
    # Clear previous
    db["members"].delete_one({"email": email})
    
    print("Registering Member...")
    res = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": password,
        "fullName": "Test Member",
        # Role defaults to MEMBER usually
    })
    
    if res.status_code != 201:
        # Maybe already exists or logic differs
        login_res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if login_res.status_code == 200:
            print("Logged in existing member.")
            token = login_res.json()["token"]
        else:
            print(f"Failed to register/login: {res.text}")
            return
    else:
        print("Registered.")
        login_res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        token = login_res.json()["token"]

    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Access Wallet Balance
    print("GET /wallet/balance")
    res = requests.get(f"{BASE_URL}/wallet/balance", headers=headers)
    print(f"Status: {res.status_code}")
    print(f"Body: {res.text}")
    
    if res.status_code == 200:
        print("✅ Member can access wallet balance.")
    else:
        print("❌ Member BLOCKED from wallet balance.")

    # 3. Access Wallet History
    print("GET /wallet/history")
    res = requests.get(f"{BASE_URL}/wallet/history", headers=headers)
    print(f"Status: {res.status_code}")
    
    if res.status_code == 200:
        print("✅ Member can access wallet history.")
    else:
        print("❌ Member BLOCKED from wallet history.")

if __name__ == "__main__":
    debug_wallet_access()
