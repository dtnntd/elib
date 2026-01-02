// PATCH SCRIPT V2: Update Schema for New Requirements
// Run: mongosh --port 27020 --file scripts/patch_schema_v2.js

const elib = db.getSiblingDB('elibrary');

print(">>> STARTING SCHEMA PATCH V2...");

// 1. ADD 'expiredAt' TO MEMBERS
print("Updating Members...");
const memberOps = [];
elib.members.find({}).forEach(m => {
    // Default expiration: 
    // BASIC: 1 year from now
    // VIP: 1 year from now
    const now = new Date();
    const expiry = new Date(now.setFullYear(now.getFullYear() + 1));

    memberOps.push({
        updateOne: {
            filter: { _id: m._id },
            update: { $set: { "subscription.expiredAt": expiry } }
        }
    });
});
if (memberOps.length > 0) {
    elib.members.bulkWrite(memberOps);
    print(`Updated ${memberOps.length} members with expiredAt.`);
}

// 2. CREATE TRANSACTIONS COLLECTION (Sharded by memberId)
print("Creating Transactions Collection...");
try {
    sh.shardCollection("elibrary.transactions", { memberId: "hashed" });
    print("Sharded elibrary.transactions by { memberId: 'hashed' }");
} catch (e) {
    print("Collection might already exist or sharding failed: " + e);
}

// 3. CREATE INDEXES FOR TRANSACTIONS
elib.transactions.createIndex({ memberId: 1, createdAt: -1 });
print("Created index { memberId: 1, createdAt: -1 } on transactions.");

print(">>> PATCH COMPLETE.");
