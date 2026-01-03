
import requests, datetime, time, sys
from pymongo import MongoClient
from bson.objectid import ObjectId

BASE = 'http://localhost:8080/api'
EMAIL = 'dtnntd@elib.vn'
PASS = '123456'
BOOK_ID = '69579a07f7abfc9b529dc29d'

# 1. Login
auth_res = requests.post(f'{BASE}/auth/login', json={'email': EMAIL, 'password': PASS})
token = auth_res.json()['token']
headers = {'Authorization': f'Bearer {token}'}

# 2. Borrow & Checkout
tomorrow = (datetime.datetime.now() + datetime.timedelta(days=1)).isoformat() + 'Z'
res = requests.post(f'{BASE}/loans/borrow', headers=headers, json={
    'bookId': BOOK_ID, 'type': 'PHYSICAL', 'pickupAppointment': tomorrow
})
if res.status_code == 201:
    loan_id = res.json()['loan']['id']
    print(f"Loan Created: {loan_id}")
    requests.put(f'{BASE}/loans/checkout/{loan_id}', headers=headers)
    print("Checked out.")
else:
    print("Borrow failed (maybe already exists), trying to find existing active loan...")
    loans = requests.get(f'{BASE}/loans/my-loans', headers=headers).json()
    for l in loans:
        if l['status'] == 'BORROWED':
            loan_id = l['id']
            break

# 3. Force Update DueDate in Mongo
# Connect to Mongo (using localhost port mapping)
client = MongoClient('mongodb://localhost:27020') # mongos1
db = client['elibrary']
coll = db['loans']

new_due_date = datetime.datetime.utcnow() - datetime.timedelta(days=5)
coll.update_one({'_id': ObjectId(loan_id)}, {'$set': {'dueDate': new_due_date}})
print(f"Force updated DueDate to {new_due_date} for loan {loan_id}")
