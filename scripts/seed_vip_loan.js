// MONGOSH SCRIPT TO SEED TEST VIP USER
// Run with: docker compose exec -T mongo mongosh mongodb://localhost:27017/elibrary < scripts/seed_vip_loan.js

const dbName = 'elibrary';
const elib = db.getSiblingDB(dbName);

print(">>> SEEDING VIP TEST USER...");

// 1. Create/Reset Test User
const email = "test_vip@elib.vn";
elib.members.deleteOne({ email: email });

const userId = new ObjectId();
const user = {
    _id: userId,
    branchId: "HN",
    fullName: "Test VIP User",
    email: email,
    role: "MEMBER",
    // '123' bcrypt hash
    passwordHash: "$2b$10$5W/fUB2KmsB/e0nTUgCs4uszLrm2gTSTspVTJcTT/q8GuKFaI9qLK",
    subscription: { active: true, plan: "VIP", expiredAt: new Date("2030-01-01") },
    walletBalance: 500000
};

elib.members.insertOne(user);
print(`Created User: ${email} (ID: ${userId})`);

// 2. Find a Book
const book = elib.books.findOne({});
if (!book) {
    print("ERROR: No books found to borrow.");
} else {
    // 3. Create Active Digital Loan
    const loan = {
        memberId: userId,
        bookId: book._id,
        branchId: "HN",
        itemType: "DIGITAL",
        status: "ACTIVE",
        borrowedAt: new Date(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 14))
    };

    elib.loans.insertOne(loan);
    print(`Created Active Digital Loan for '${book.title}'`);
}
