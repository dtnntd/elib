/**
 * SEED SCRIPT FOR E-LIBRARY
 * Generates 10,000 Books + 40,000 Copies
 */

const fs = require('fs');
const { LCC_CLASSES, REAL_TITLES_VN, VN_NAMES, PUBLISHERS } = require('./data_patterns.js');

const TOTAL_BOOKS = 10000;
const BRANCHES = ["HN", "HP", "DN"];
const CSV_PATH = "/tmp/books_source.csv";

// Helper: Read CSV manually (mongosh doesn't have csv-parser)
function readCsv(path) {
    try {
        const content = fs.readFileSync(path, 'utf8');
        const lines = content.split('\n');
        // Simple regex to handle quoted commas approx
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            // Naive split by comma, ignoring commas in quotes
            const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (row && row.length > 9) {
                // goodbooks-10k indices: 7: authors, 9: original_title, 10: title
                let authors = row[7] ? row[7].replace(/"/g, '') : "Unknown";
                let title = row[10] ? row[10].replace(/"/g, '') : (row[9] ? row[9].replace(/"/g, '') : "Untitled");
                let isbn = row[5] ? row[5].replace(/"/g, '') : `978-${Math.floor(Math.random() * 1000000000)}`;
                let year = row[8] ? parseInt(row[8]) : 2000;

                if (title !== "Untitled") {
                    data.push({ isbn, title, authors: authors.split(','), year });
                }
            }
        }
        return data;
    } catch (e) {
        print("Error reading CSV: " + e);
        return [];
    }
}

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateNameVN() {
    return `${rand(VN_NAMES.first)} ${rand(VN_NAMES.mid)} ${rand(VN_NAMES.last)}`;
}

function seed() {
    const elib = db.getSiblingDB('elibrary');
    print(">>> STARTING SEED PROCESS...");

    // 0. LOAD REAL DATA
    const intlBooks = readCsv(CSV_PATH);
    print(`Loaded ${intlBooks.length} international books from CSV.`);

    // 1. CLEAR OLD DATA
    print("Clearing old collections...");
    elib.branches.deleteMany({});
    elib.books.deleteMany({});
    elib.physical_copies.deleteMany({});
    elib.digital_licenses.deleteMany({});
    elib.members.deleteMany({});
    elib.loans.deleteMany({});
    elib.events.deleteMany({});

    // 2. SEED BRANCHES
    print("Seeding Branches...");
    elib.branches.insertMany([
        { _id: "HN", city: "Hanoi", name: "Thư viện Hà Nội" },
        { _id: "HP", city: "Haiphong", name: "Thư viện Hải Phòng" },
        { _id: "DN", city: "Danang", name: "Thư viện Đà Nẵng" }
    ]);

    // 3. SEED BOOKS
    const bookOps = [];
    print(`Generating ${TOTAL_BOOKS} books... (Target: 40% VN, 60% Intl)`);

    for (let i = 0; i < TOTAL_BOOKS; i++) {
        let book;
        const isVN = (i < TOTAL_BOOKS * 0.4); // 40% VN

        if (isVN) {
            // VN Strategy
            const baseTitle = rand(REAL_TITLES_VN);
            const variation = [
                "", " (Tái bản 2024)", " - Tập 1", " - Tập 2", " (Bìa cứng)",
                " - Phê bình và chú giải", " (Phiên bản đặc biệt)"
            ][Math.floor(Math.random() * 7)];

            const lccKey = ["PL", "DS", "KH"][Math.floor(Math.random() * 3)];
            const category = LCC_CLASSES[lccKey];

            book = {
                _id: new ObjectId(),
                isbn: `978-604-${Math.floor(Math.random() * 100000)}-${i}`, // Unique
                title: baseTitle + variation,
                authors: [generateNameVN()],
                subjects: [category.name, rand(category.topics), category.code],
                lcc_code: category.code,
                publisher: rand(PUBLISHERS),
                publishedYear: 2000 + Math.floor(Math.random() * 24),
                price: (Math.floor(Math.random() * 150) + 50) * 1000,
                lang: "Vietnamese",
                description: `Sách ${baseTitle} thuộc chủ đề ${category.name}.`
            };
        } else {
            // Intl Strategy
            const source = intlBooks.length > 0 ? intlBooks[i % intlBooks.length] : { title: "Generic Tech Book " + i, authors: ["John Doe"], isbn: "978-0000000000" };

            // LCC - Avoid QA
            const lccKey = ["Q", "T", "H", "B", "P"][Math.floor(Math.random() * 5)];
            const category = LCC_CLASSES[lccKey];

            book = {
                _id: new ObjectId(),
                isbn: `${source.isbn}-${i}`,
                title: source.title,
                authors: source.authors,
                subjects: [category.name, rand(category.topics), category.code],
                lcc_code: category.code,
                publisher: rand(PUBLISHERS),
                publishedYear: source.year || (2000 + Math.floor(Math.random() * 24)),
                price: (Math.floor(Math.random() * 300) + 100) * 1000, // Tech books slightly more expensive
                lang: "English",
                description: `Original title: ${source.title}. Imported from Goodbooks-10k.`
            };
        }

        bookOps.push({ insertOne: { document: book } });
        if (bookOps.length >= 1000) {
            elib.books.bulkWrite(bookOps);
            bookOps.length = 0;
            print(`Inserted ${i + 1} books...`);
        }
    }
    if (bookOps.length > 0) elib.books.bulkWrite(bookOps);

    // 4. INVENTORY
    print("Generating Inventory...");
    const allBooks = elib.books.find({}, { _id: 1, isbn: 1, lcc_code: 1 }).toArray();

    let copyOps = [];
    let licenseOps = [];

    allBooks.forEach(b => {
        const r = Math.random();
        const hasPhys = r < 0.8;
        const hasDig = (r < 0.5) || (r >= 0.8);

        if (hasPhys) {
            const g = Math.random();
            let targets = [];
            if (g < 0.4) targets = ["HN", "HP", "DN"];
            else if (g < 0.7) targets = [["HN", "HP"], ["HN", "DN"], ["HP", "DN"]][Math.floor(Math.random() * 3)];
            else targets = [rand(BRANCHES)];

            targets.forEach(br => {
                let count = (targets.length === 3) ? (10 + Math.floor(Math.random() * 10)) : (1 + Math.floor(Math.random() * 3));
                for (let k = 0; k < count; k++) {
                    copyOps.push({
                        insertOne: {
                            document: {
                                bookId: b._id, branchId: br,
                                barcode: `${br}-${b._id.toString().substring(18)}-${k}`,
                                status: Math.random() < 0.8 ? "AVAILABLE" : "BORROWED",
                                shelf: `${b.lcc_code}-${Math.floor(Math.random() * 100)}`
                            }
                        }
                    });
                }
            });
        }

        if (hasDig) {
            licenseOps.push({
                insertOne: {
                    document: {
                        bookId: b._id,
                        vendor: rand(["OverDrive", "Springer", "ProQuest"]),
                        accessModel: Math.random() < 0.4 ? "OCOU" : "UNLIMITED",
                        concurrentLimit: Math.random() < 0.4 ? 1 : 50,
                        activeAccess: Math.floor(Math.random() * 5)
                    }
                }
            });
        }

        if (copyOps.length >= 2000) { elib.physical_copies.bulkWrite(copyOps); copyOps = []; }
        if (licenseOps.length >= 2000) { elib.digital_licenses.bulkWrite(licenseOps); licenseOps = []; }
    });

    if (copyOps.length > 0) elib.physical_copies.bulkWrite(copyOps);
    if (licenseOps.length > 0) elib.digital_licenses.bulkWrite(licenseOps);

    print("Inventory Complete.");

    // 5. MEMBERS
    print("Generating Members...");
    const members = [];
    for (let i = 0; i < 1000; i++) {
        const r = Math.random();
        let br = r < 0.5 ? "HN" : (r < 0.75 ? "HP" : "DN");
        members.push({
            insertOne: {
                document: {
                    _id: new ObjectId(),
                    branchId: br, fullName: generateNameVN(),
                    email: `user${i}@elib.vn`, role: "MEMBER",
                    // Password: '123456' (Bcrypt)
                    passwordHash: "$2b$10$5W/fUB2KmsB/e0nTUgCs4uszLrm2gTSTspVTJcTT/q8GuKFaI9qLK",
                    subscription: { active: true, plan: "BASIC" }
                }
            }
        });
    }
    elib.members.bulkWrite(members);

    print("SEED COMPLETE.");
}

seed();
