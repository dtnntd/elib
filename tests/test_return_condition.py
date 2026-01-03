
import requests, datetime, time, sys

BASE = 'http://localhost:8080/api'
EMAIL = 'dtnntd@elib.vn'
PASS = '123456'
BOOK_ID = '69579a07f7abfc9b529dc29d'

# 1. Login
auth_res = requests.post(f'{BASE}/auth/login', json={'email': EMAIL, 'password': PASS})
if auth_res.status_code != 200:
    print(f'Login Failed: {auth_res.text}')
    sys.exit(1)
token = auth_res.json()['token']
headers = {'Authorization': f'Bearer {token}'}
print('Login Success')

# 2. Cleanup (Return any existing)
try:
    loans = requests.get(f'{BASE}/loans/my-loans', headers=headers).json()
    for l in loans:
        if l['status'] == 'RESERVED':
             requests.put(f'{BASE}/loans/checkout/{l["id"]}', headers=headers)
        if l['status'] in ['BORROWED', 'RESERVED', 'ACTIVE', 'OVERDUE']:
            requests.put(f'{BASE}/loans/return/{l["id"]}', headers=headers)
            print(f'Returned stray loan {l["id"]}')
    time.sleep(2)
except:
    pass

# 3. Reserve
tomorrow = (datetime.datetime.now() + datetime.timedelta(days=1)).isoformat() + 'Z'
res_borrow = requests.post(f'{BASE}/loans/borrow', headers=headers, json={
    'bookId': BOOK_ID, 'type': 'PHYSICAL', 'pickupAppointment': tomorrow
})
if res_borrow.status_code != 201:
    print(f'Borrow Failed: {res_borrow.text}')
    sys.exit(1)
loan_id = res_borrow.json()['loan']['id']
print(f'Reserved Loan: {loan_id}')

# 4. Checkout
res_checkout = requests.put(f'{BASE}/loans/checkout/{loan_id}', headers=headers)
if res_checkout.status_code != 200:
    print(f'Checkout Failed: {res_checkout.text}')
    sys.exit(1)
print('Checkout Success')

# 5. Return with DAMAGED condition
res_return = requests.put(f'{BASE}/loans/return/{loan_id}', headers=headers, json={'condition': 'DAMAGED'})
if res_return.status_code != 200:
    print(f'Return Failed: {res_return.text}')
    sys.exit(1)

data = res_return.json()
print(f"Return Response: {data}")

# Verify Fine (Should be 50000)
fine = data.get('fine', 0)
if fine != 50000:
    print(f"FAIL: Expected fine 50000, got {fine}")
    sys.exit(1)

print("PASS: Fine calculated correctly for DAMAGED book")
