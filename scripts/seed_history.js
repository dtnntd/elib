/**
 * SEED HISTORY SCRIPT
 * Generates 50,000 Loans & Events (Past & Present)
 * Supports: PHYSICAL (Books) & EBOOK (Digital Licenses)
 */

const TOTAL_HISTORY = 50000;

function seedHistory() {
    const elib = db.getSiblingDB('elibrary');
    print(">>> STARTING HISTORY SEEDING (Target: 50,000 Txns)...");

    // 0. CLEAR OLD HISTORY (optional, but cleaner for re-runs)
    print("Clearing old history (loans, events)...");
    elib.loans.deleteMany({});
    elib.events.deleteMany({});

    // 1. Fetch Resources
    const members = elib.members.find({}, { _id: 1, branchId: 1 }).toArray();
    const copies = elib.physical_copies.find({}, { _id: 1, branchId: 1, bookId: 1 }).toArray();
    const licenses = elib.digital_licenses.find({}, { _id: 1, bookId: 1 }).toArray();

    if (members.length === 0 || copies.length === 0) {
        print("Error: No members or copies found. Run seed.js first.");
        return;
    }

    // OPTIMIZATION: Index physical copies by branch
    const copiesByBranch = {
        "HN": copies.filter(c => c.branchId === "HN"),
        "HP": copies.filter(c => c.branchId === "HP"),
        "DN": copies.filter(c => c.branchId === "DN")
    };

    print(`Resources: Members(${members.length}), PhysCopies(${copies.length}), DigLicenses(${licenses.length})`);

    const loanOps = [];
    const eventOps = [];
    const copyUpdateOps = [];

    for (let i = 0; i < TOTAL_HISTORY; i++) {
        const member = members[Math.floor(Math.random() * members.length)];
        const _id = new ObjectId();

        // MIX: 70% Physical, 30% Digital
        const isDigital = Math.random() < 0.3 && licenses.length > 0;

        // Date Logic (Past 365 days)
        const daysAgo = Math.floor(Math.random() * 365);
        const borrowedAt = new Date();
        borrowedAt.setDate(borrowedAt.getDate() - daysAgo);

        if (isDigital) {
            // --- E-BOOK ---
            const license = licenses[Math.floor(Math.random() * licenses.length)];

            // E-books always "Returned" automatically if date < now, or Active if date > now (less likely for old dates)
            // But usually E-books just have "Access Expired". We'll model as RETURNED for closed history.

            const duration = 14; // Fixed 2 weeks standard for ebooks
            let dueDate = new Date(borrowedAt.getTime() + duration * 24 * 60 * 60 * 1000);

            const loan = {
                _id: _id,
                memberId: member._id,
                branchId: member.branchId, // Digital loan associated with member's branch
                bookId: license.bookId,
                copyId: license._id, // Link to License
                itemType: "EBOOK",
                borrowedAt: borrowedAt,
                dueDate: dueDate,
                status: (new Date() > dueDate) ? "RETURNED" : "BORROWED" // Ebooks auto-return
            };
            if (loan.status === "RETURNED") {
                loan.returnedAt = dueDate; // Auto-returned at due date
            }

            // Events
            eventOps.push({
                insertOne: {
                    document: {
                        _id: new ObjectId(), type: "BORROW",
                        branchId: member.branchId, memberId: member._id, bookId: license.bookId, copyId: license._id,
                        occurredAt: borrowedAt, details: { method: "DIGITAL_DOWNLOAD" }
                    }
                }
            });

            if (loan.status === "RETURNED") {
                eventOps.push({
                    insertOne: {
                        document: {
                            _id: new ObjectId(), type: "RETURN",
                            branchId: member.branchId, memberId: member._id, bookId: license.bookId, copyId: license._id,
                            occurredAt: dueDate, details: { method: "AUTO_EXPIRY" }
                        }
                    }
                });
            }

            loanOps.push({ insertOne: { document: loan } });

        } else {
            // --- PHYSICAL BOOK ---
            let copy;
            // Prefer local branch
            if (Math.random() < 0.9) {
                const localCopies = copiesByBranch[member.branchId];
                if (localCopies && localCopies.length > 0) copy = localCopies[Math.floor(Math.random() * localCopies.length)];
                else copy = copies[Math.floor(Math.random() * copies.length)];
            } else {
                copy = copies[Math.floor(Math.random() * copies.length)];
            }
            if (!copy) continue;

            const isClosed = Math.random() < 0.9;
            const loan = {
                _id: _id,
                memberId: member._id,
                branchId: copy.branchId,
                bookId: copy.bookId,
                copyId: copy._id,
                itemType: "PHYSICAL",
                borrowedAt: borrowedAt,
                dueDate: new Date(borrowedAt.getTime() + 14 * 24 * 60 * 60 * 1000)
            };

            eventOps.push({
                insertOne: {
                    document: {
                        _id: new ObjectId(), type: "BORROW",
                        branchId: copy.branchId, memberId: member._id, bookId: copy.bookId, copyId: copy._id,
                        occurredAt: borrowedAt, details: { method: "COUNTER" }
                    }
                }
            });

            if (isClosed) {
                const duration = Math.floor(Math.random() * 20) + 1;
                let returnedAt = new Date(borrowedAt.getTime() + duration * 24 * 60 * 60 * 1000);
                if (returnedAt > new Date()) returnedAt = new Date();

                loan.returnedAt = returnedAt;
                loan.status = "RETURNED";

                eventOps.push({
                    insertOne: {
                        document: {
                            _id: new ObjectId(), type: "RETURN",
                            branchId: copy.branchId, memberId: member._id, bookId: copy.bookId, copyId: copy._id,
                            occurredAt: returnedAt, details: { condition: "GOOD" }
                        }
                    }
                });
            } else {
                loan.status = (new Date() > loan.dueDate) ? "OVERDUE" : "BORROWED";
                copyUpdateOps.push({
                    updateOne: {
                        filter: { _id: copy._id },
                        update: { $set: { status: "BORROWED" } }
                    }
                });
            }
            loanOps.push({ insertOne: { document: loan } });
        }

        if (loanOps.length >= 2000) {
            elib.loans.bulkWrite(loanOps);
            elib.events.bulkWrite(eventOps);
            if (copyUpdateOps.length > 0) elib.physical_copies.bulkWrite(copyUpdateOps);

            loanOps.length = 0;
            eventOps.length = 0;
            copyUpdateOps.length = 0;
            print(`Generated ${i + 1} transactions...`);
        }
    }

    if (loanOps.length > 0) {
        elib.loans.bulkWrite(loanOps);
        elib.events.bulkWrite(eventOps);
        if (copyUpdateOps.length > 0) elib.physical_copies.bulkWrite(copyUpdateOps);
    }

    print("HISTORY SEED COMPLETE.");
}

seedHistory();
