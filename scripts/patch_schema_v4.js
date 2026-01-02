// PATCH SCRIPT V4: Add 'price' to books
// Run: docker exec -i mongos1 mongosh --port 27020 < scripts/patch_schema_v4.js

const elib = db.getSiblingDB('elibrary');

print(">>> STARTING SCHEMA PATCH V4 (Book Price)...");

// 1. ADD 'price' TO BOOKS
print("Backfilling random prices (50k - 200k) for all books...");

// Using updateMany with pipeline to set dynamic random value is tricky in simple MQL.
// For 10,000 docs, bulkWrite matches are better or iterating.
// Let's use bulkWrite for performance.

const books = elib.books.find({}, { _id: 1 }).toArray();
const ops = books.map(b => {
    // Random price: 50,000 to 200,000, rounded to thousands
    const price = (Math.floor(Math.random() * 150) + 50) * 1000;
    return {
        updateOne: {
            filter: { _id: b._id },
            update: { $set: { price: price } }
        }
    };
});

if (ops.length > 0) {
    print(`Preparing to update ${ops.length} books...`);
    // Split into chunks if too big (though 10k is fine for bulkWrite usually, 
    // but safe limit is 1000-2000 per batch often recommended for client-side scripts to avoid memory issues)
    const BATCH_SIZE = 1000;
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
        const batch = ops.slice(i, i + BATCH_SIZE);
        elib.books.bulkWrite(batch);
        print(`Processed batch ${i / BATCH_SIZE + 1}`);
    }
}

print(">>> PATCH V4 COMPLETE.");
