import requests
from pymongo import MongoClient
import time

# Config
BASE_URL = "http://localhost:8080/api"
MONGO_URI = "mongodb://localhost:27017"

# Setup DB
client = MongoClient(MONGO_URI)
db = client["elibrary_db"]

def debug_reserved():
    print("--- Debugging RESERVED Loans ---")
    
    # 1. Check DB directly
    loans_coll = db["loans"]
    reserved_count = loans_coll.count_documents({"status": "RESERVED"})
    print(f"DB: Found {reserved_count} RESERVED loans in MongoDB.")
    
    if reserved_count == 0:
        print("Creating a dummy RESERVED loan for testing...")
        # Insert a dummy reserved loan
        # We need valid book and member IDs. 
        # For quick hack, let's just use random IDs, but lookup will fail (return empty member/book)
        # Wait, if lookup fails, unwind might DROP the document!
        # This is a likely culprit if I messed up unwind.
        
        # Let's try to get a real book and member first
        member = db["members"].find_one()
        book = db["books"].find_one()
        
        if member and book:
            dummy_loan = {
                "memberId": member["_id"],
                "bookId": book["_id"],
                "status": "RESERVED",
                "pickupAppointment": time.time() + 86400,
                "createdAt": time.time(),
                # NO borrowedAt
            }
            loans_coll.insert_one(dummy_loan)
            print("Inserted dummy RESERVED loan.")
            reserved_count = 1
        else:
            print("Skipping insert: No member/book found.")
            
    # 2. Check API
    # Login as admin to get token
    # (Mocking typical token flow or just assuming auth disabled for dev/ using existing valid token if possible?)
    # For now, I'll assume I need to login.
    try:
        res = requests.post(f"{BASE_URL}/auth/login", json={"email": "admin@library.com", "password": "password123"})
        token = res.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        print("\nCalling API: GET /loans/all?status=RESERVED")
        res = requests.get(f"{BASE_URL}/loans/all?status=RESERVED", headers=headers)
        
        if res.status_code == 200:
            data = res.json()
            print(f"API: Returned {len(data)} loans.")
            if len(data) == 0 and reserved_count > 0:
                 print("!!! API returned 0 but DB has reserved loans. POTENTIAL BUG.")
        else:
            print(f"API Error: {res.status_code} - {res.text}")
            
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    debug_reserved()
