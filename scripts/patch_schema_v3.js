// PATCH SCRIPT V3: Add walletBalance
// Run: docker exec -i mongos1 mongosh --port 27020 < scripts/patch_schema_v3.js

const elib = db.getSiblingDB('elibrary');

print(">>> STARTING SCHEMA PATCH V3 (Wallet Balance)...");

// 1. ADD 'walletBalance' TO MEMBERS
print("Initializing walletBalance = 0 for all members...");
const res = elib.members.updateMany(
    { walletBalance: { $exists: false } },
    { $set: { walletBalance: 0 } }
);

print(`Matched: ${res.matchedCount}, Modified: ${res.modifiedCount}`);
print(">>> PATCH V3 COMPLETE.");
