
import pymongo
import bcrypt
import datetime
from bson.objectid import ObjectId

# Connect to Mongos
client = pymongo.MongoClient("mongodb://localhost:27020")
db = client["elibrary"]
collection = db["members"]

# Password: "123456"
# Generated via: bcrypt.hashpw(b"123456", bcrypt.gensalt())
# We use a fixed hash for simplicity if bcrypt is not locally available, 
# but here we generate it to be safe.
salt = bcrypt.gensalt()
hashed = bcrypt.hashpw(b"123456", salt).decode('utf-8')

users = [
    {
        "email": "staff_hn@elib.com",
        "fullName": "Staff Hanoi",
        "branchId": "HN",
        "role": "STAFF",
        "passwordHash": hashed,
        "walletBalance": 5000000,
        "subscription": {"active": True, "plan": "VIP", "expiredAt": datetime.datetime.now() + datetime.timedelta(days=365)},
        "createdAt": datetime.datetime.now()
    },
    {
        "email": "staff_hp@elib.com",
        "fullName": "Staff Haiphong",
        "branchId": "HP",
        "role": "STAFF",
        "passwordHash": hashed,
        "walletBalance": 5000000,
        "subscription": {"active": True, "plan": "VIP", "expiredAt": datetime.datetime.now() + datetime.timedelta(days=365)},
        "createdAt": datetime.datetime.now()
    },
    {
        "email": "staff_dn@elib.com",
        "fullName": "Staff Danang",
        "branchId": "DN",
        "role": "STAFF",
        "passwordHash": hashed,
        "walletBalance": 5000000,
        "subscription": {"active": True, "plan": "VIP", "expiredAt": datetime.datetime.now() + datetime.timedelta(days=365)},
        "createdAt": datetime.datetime.now()
    }
]

print(">>> Seeding Demo Users...")

for u in users:
    # Upsert based on email
    result = collection.update_one(
        {"email": u["email"]},
        {"$set": u},
        upsert=True
    )
    print(f"User {u['email']} processed.")

print(">>> Done! Password for all is: 123456")
