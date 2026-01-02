// MONGOSH SCRIPT TO SEED SPECIFIC USER LOAN
// Run with: docker exec -i mongos1 mongosh --port 27020 < scripts/seed_dtnntd_loan.js

const dbName = 'elibrary';
const elib = db.getSiblingDB(dbName);

print(">>> SEEDING LOAN FOR dtnntd@elib.vn...");

const email = "dtnntd@elib.vn";
let user = elib.members.findOne({ email: email });

if (!user) {
    print(`User ${email} not found. Creating...`);
    user = {
        _id: new ObjectId(),
        branchId: "HN",
        fullName: "User Test",
        email: email,
        role: "MEMBER",
        // '123456' bcrypt hash (copying from valid hash or generating new if possible, mocking here with known hash for 123456)
        // Using the hash from seed.js for '123456': $2b$10$5W/fUB2KmsB/e0nTUgCs4uszLrm2gTSTspVTJcTT/q8GuKFaI9qLK  (Wait, seed.js says this is 123456?)
        // Seed.js comment: // Password: '123456' (Bcrypt) -> $2b$10$5W/fUB2KmsB/e0nTUgCs4uszLrm2gTSTspVTJcTT/q8GuKFaI9qLK
        passwordHash: "$2b$10$5W/fUB2KmsB/e0nTUgCs4uszLrm2gTSTspVTJcTT/q8GuKFaI9qLK",
        subscription: { active: true, plan: "VIP", expiredAt: new Date("2030-01-01") },
        walletBalance: 1000000
    };
    elib.members.insertOne(user);
} else {
    // Ensure VIP for E-book access
    elib.members.updateOne({ _id: user._id }, { $set: { "subscription.plan": "VIP" } });
    print(`User ${email} found. Updated to VIP.`);
}

// Check if already has active digital loan
const existingLoan = elib.loans.findOne({ memberId: user._id, status: "ACTIVE", itemType: "DIGITAL" });

if (existingLoan) {
    print("User already has an active digital loan.");
} else {
    // Find a book
    const book = elib.books.findOne({});
    if (book) {
        const loan = {
            memberId: user._id,
            bookId: book._id,
            branchId: "HN",
            itemType: "DIGITAL",
            status: "ACTIVE",
            borrowedAt: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 14))
        };
        elib.loans.insertOne(loan);
        print(`Created Active Digital Loan for '${book.title}'`);
    } else {
        print("Error: No books found.");
    }
}
