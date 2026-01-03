
import requests, datetime, time, sys
from pymongo import MongoClient
from bson.objectid import ObjectId

BASE = 'http://localhost:8080/api'
EMAIL = 'dtnntd@elib.vn'
PASS = '123456'
ADMIN_EMAIL = 'admin@elib.vn' # Assuming admin login needed for Staff return, or reusing dtnntd if staff is allowed to return own? 
# Actually ReturnBook now allows Staff/Admin to return ANY book. 
# But dtnntd is ADMIN? Let's assume so or use staff login.
# Wait, previous tests used dtnntd for everything. Let's stick to it.

# 1. Login
auth_res = requests.post(f'{BASE}/auth/login', json={'email': EMAIL, 'password': PASS})
if auth_res.status_code != 200:
    print(f"Login failed: {auth_res.text}")
    sys.exit(1)
token = auth_res.json()['token']
user_id = auth_res.json()['user']['id']
headers = {'Authorization': f'Bearer {token}'}

print("Login Success")

# 2. Check Initial Wallet
me_res = requests.get(f'{BASE}/auth/me', headers=headers) # Or get from login response? API doesn't have /me usually, assuming logic.
# Actually API doesn't have /me. Let's check wallet history or assume 0 based on login. 
# Better: /wallet/history
hist_res = requests.get(f'{BASE}/wallet/history', headers=headers)
if hist_res.status_code == 200:
    print("Wallet History Valid")
else:
    print(f"Failed to get wallet history: {hist_res.text}")

# 3. Top Up 100,000
topup_res = requests.post(f'{BASE}/wallet/topup', headers=headers, json={'amount': 100000})
if topup_res.status_code == 200:
    print(f"TopUp Success: New Balance = {topup_res.json()['newBalance']}")
else:
    print(f"TopUp Failed: {topup_res.text}")
    sys.exit(1)

# 4. Create & Borrow Book (to generate fine)
# Find a book
# books = requests.get(f'{BASE}/books').json()
book_id = '69579a07f7abfc9b529dc29d' # books[0]['id']

tomorrow = (datetime.datetime.now() + datetime.timedelta(days=1)).isoformat() + 'Z'
loan_res = requests.post(f'{BASE}/loans/borrow', headers=headers, json={
    'bookId': book_id, 'type': 'PHYSICAL', 'pickupAppointment': tomorrow
})

if loan_res.status_code == 201:
    loan_id = loan_res.json()['loan']['id']
    requests.put(f'{BASE}/loans/checkout/{loan_id}', headers=headers)
    print(f"Loan Created & Checked Out: {loan_id}")
else:
    print("Borrow failed, attempting to find existing active loan...")
    my_loans = requests.get(f'{BASE}/loans/my-loans', headers=headers).json()
    loan_id = None
    for l in my_loans:
        if l['status'] in ['BORROWED', 'ACTIVE', 'OVERDUE']:
            loan_id = l['id']
            break
    
    if not loan_id:
        print("No active loan found to return.")
        sys.exit(1)
    print(f"Using existing loan: {loan_id}")

# 5. Force Overdue (5 days => 25k fine)
client = MongoClient('mongodb://localhost:27020')
coll = client['elibrary']['loans']
past_date = datetime.datetime.utcnow() - datetime.timedelta(days=5)
coll.update_one({'_id': ObjectId(loan_id)}, {'$set': {'dueDate': past_date}})
print(f"Force Overdue: {loan_id}")

# 6. Return Book (As Staff - assuming dtnntd is staff/admin)
return_res = requests.put(f'{BASE}/loans/return/{loan_id}', headers=headers, json={'condition': 'GOOD'})
if return_res.status_code == 200:
    fine = return_res.json()['fine']
    print(f"Return Success. Fine: {fine}")
    if fine > 0:
        print("PASS: Fine detected.")
    else:
        print("FAIL: No fine detected.")
else:
    print(f"Return Failed: {return_res.text}")
    sys.exit(1)

# 7. Check Transaction & Balance Deduction
hist_res = requests.get(f'{BASE}/wallet/history', headers=headers)
txs = hist_res.json()
fine_tx = next((t for t in txs if t['type'] == 'FINE' and t['amount'] == -fine), None)
if fine_tx:
    print("PASS: Fine transaction log found.")
else:
    print("FAIL: Fine transaction log NOT found.")
