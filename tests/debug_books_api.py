import requests
import json

# Config
BASE_URL = "http://localhost:8080/api"

def debug_books():
    print("--- Debugging GET /books response ---")
    try:
        res = requests.get(f"{BASE_URL}/books?limit=10")
        if res.status_code == 200:
            data = res.json()
            books = data.get("data", [])
            print(f"Count: {len(books)}")
            
            for i, b in enumerate(books):
                print(f"\nBook {i}:")
                print(f"  ID: {b.get('id')}")
                print(f"  Title: {b.get('title')}")
                print(f"  Authors ({type(b.get('authors'))}): {b.get('authors')}")
                print(f"  Subjects ({type(b.get('subjects'))}): {b.get('subjects')}")
                
                if b.get('authors') is None:
                    print("  !!! ALERT: Authors is None")
                if b.get('subjects') is None:
                    print("  !!! ALERT: Subjects is None")
        else:
            print(f"Error: {res.status_code}")
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    debug_books()
