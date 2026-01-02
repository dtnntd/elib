# Các lệnh thực thi dự án e-Library (MongoDB Sharding)

## 1. Khởi động MongoDB Sharded Cluster

```bash
cd /home/dtnntd/csdl/final/deloy

# Khởi động tất cả containers
docker compose up -d

# Kiểm tra trạng thái containers
docker compose ps

# Xem logs nếu có vấn đề
docker compose logs mongos1
```

## 2. Kiểm tra cấu hình Sharding

```bash
# Kết nối mongos và kiểm tra shard status
docker exec mongos1 mongosh --port 27020 --eval 'sh.status()'

# Xem danh sách shards
docker exec mongos1 mongosh --port 27020 --eval 'db.adminCommand({ listShards: 1 })'

# Kiểm tra databases đã sharded
docker exec mongos1 mongosh --port 27020 --eval 'use config; db.databases.find().pretty()'

# Kiểm tra collections đã sharded
docker exec mongos1 mongosh --port 27020 elibrary --eval 'db.getCollectionNames()'
```

## 3. Kiểm tra Replica Set

```bash
# Kiểm tra rsCity (HN/HP/DN)
docker exec hn1 mongosh --port 27017 --eval 'rs.status()' | grep -E 'name|stateStr'

# Xem chi tiết primary/secondary
docker exec hn1 mongosh --port 27017 --eval 'rs.isMaster().primary'

# Kiểm tra rsExtra
docker exec ex1 mongosh --port 27217 --eval 'rs.status()' | grep -E 'name|stateStr'
```

## 4. Seed dữ liệu mẫu (~10k records)

Tạo script seed data:

```bash
cat > /home/dtnntd/csdl/final/scripts/seed.js << 'EOF'
// Kết nối qua mongos
const conn = new Mongo("mongos1:27020");
const db = conn.getDB("elibrary");

print("Seeding data...");

// Lấy danh sách branches
const branches = db.branches.find().toArray();
const branchIds = branches.map(b => b._id);
print(`Found ${branches.length} branches: ${branchIds.join(', ')}`);

// Generate Books (1000 books)
print("\nGenerating 1000 books...");
const books = [];
const genres = ["Fiction", "Non-Fiction", "Science", "Technology", "History", "Biography", "Literature", "Business"];
const publishers = ["O'Reilly", "Pearson", "McGraw-Hill", "Wiley", "Springer", "Cambridge", "Oxford"];

for (let i = 1; i <= 1000; i++) {
  books.push({
    _id: `BK${String(i).padStart(6, '0')}`,
    isbn: `978-${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
    title: `Book Title ${i} - ${genres[i % genres.length]}`,
    authors: [`Author ${Math.floor(i/10) + 1}`, `Co-Author ${Math.floor(i/20) + 1}`],
    subjects: [genres[i % genres.length], genres[(i+1) % genres.length]],
    description: `Description for book ${i}. This book covers topics in ${genres[i % genres.length]}.`,
    publisher: publishers[i % publishers.length],
    publishedYear: 2000 + (i % 24)
  });
}
db.books.insertMany(books);
print(`✓ Inserted ${books.length} books`);

// Generate Copies (5000 copies distributed across branches)
print("\nGenerating 5000 copies across branches...");
const copies = [];
let barcodeCounter = 100000;

for (let i = 0; i < 5000; i++) {
  const bookId = books[Math.floor(Math.random() * books.length)]._id;
  const branchId = branchIds[i % branchIds.length];
  const status = (i % 10 === 0) ? "borrowed" : "available";
  
  copies.push({
    _id: `CP${String(i+1).padStart(6, '0')}`,
    bookId: bookId,
    branchId: branchId,
    barcode: `BC${barcodeCounter++}`,
    status: status,
    condition: ["New", "Good", "Fair"][i % 3]
  });
}
db.copies.insertMany(copies);
print(`✓ Inserted ${copies.length} copies`);

// Generate Members (1000 members)
print("\nGenerating 1000 members...");
const members = [];
for (let i = 1; i <= 1000; i++) {
  const branchId = branchIds[i % branchIds.length];
  members.push({
    _id: `MEM${String(i).padStart(6, '0')}`,
    branchId: branchId,
    fullName: `Member ${i} - ${branchId}`,
    email: `member${i}@example.com`,
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEF",  // dummy hash
    phone: `090${String(1000000 + i).substring(1)}`,
    role: (i % 50 === 0) ? "librarian" : "member",
    joinedAt: new Date(2020 + (i % 5), (i % 12), (i % 28) + 1)
  });
}
db.members.insertMany(members);
print(`✓ Inserted ${members.length} members`);

// Generate Loans (3000 loans)
print("\nGenerating 3000 loans...");
const loans = [];
const now = new Date();
for (let i = 1; i <= 3000; i++) {
  const borrowedAt = new Date(now.getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000);
  const dueAt = new Date(borrowedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  const returned = i % 3 === 0;
  
  const copy = copies[Math.floor(Math.random() * copies.length)];
  const member = members.filter(m => m.branchId === copy.branchId)[0] || members[0];
  
  loans.push({
    _id: `LN${String(i).padStart(6, '0')}`,
    branchId: copy.branchId,
    memberId: member._id,
    copyId: copy._id,
    borrowedAt: borrowedAt,
    dueAt: dueAt,
    returnedAt: returned ? new Date(borrowedAt.getTime() + Math.random() * 14 * 24 * 60 * 60 * 1000) : null,
    status: returned ? "returned" : (dueAt < now ? "overdue" : "active"),
    renewCount: Math.floor(Math.random() * 3)
  });
}
db.loans.insertMany(loans);
print(`✓ Inserted ${loans.length} loans`);

// Generate Transactions (6000+ transactions)
print("\nGenerating 6000+ transactions...");
const transactions = [];
let txCounter = 1;

// Transactions for each loan (borrow + return)
for (let loan of loans) {
  // Borrow transaction
  transactions.push({
    _id: `TX${String(txCounter++).padStart(8, '0')}`,
    branchId: loan.branchId,
    type: "borrow",
    memberId: loan.memberId,
    copyId: loan.copyId,
    loanId: loan._id,
    createdAt: loan.borrowedAt
  });
  
  // Return transaction
  if (loan.returnedAt) {
    transactions.push({
      _id: `TX${String(txCounter++).padStart(8, '0')}`,
      branchId: loan.branchId,
      type: "return",
      memberId: loan.memberId,
      copyId: loan.copyId,
      loanId: loan._id,
      createdAt: loan.returnedAt
    });
  }
}

db.transactions.insertMany(transactions);
print(`✓ Inserted ${transactions.length} transactions`);

// Summary
print("\n========================================");
print("Seed Data Summary:");
print(`  Books:        ${db.books.countDocuments()}`);
print(`  Copies:       ${db.copies.countDocuments()}`);
print(`  Members:      ${db.members.countDocuments()}`);
print(`  Loans:        ${db.loans.countDocuments()}`);
print(`  Transactions: ${db.transactions.countDocuments()}`);
print("========================================");

// Distribution by branch
print("\nData distribution by branch:");
for (let branch of branches) {
  const copyCount = db.copies.countDocuments({branchId: branch._id});
  const memberCount = db.members.countDocuments({branchId: branch._id});
  const loanCount = db.loans.countDocuments({branchId: branch._id});
  print(`  ${branch._id} (${branch.city}):`);
  print(`    Copies: ${copyCount}, Members: ${memberCount}, Loans: ${loanCount}`);
}
EOF
```

Chạy seed:

```bash
# Copy script vào container và chạy
docker exec -i mongos1 mongosh --port 27020 elibrary < /home/dtnntd/csdl/final/scripts/seed.js
```

Hoặc tạo container riêng để seed:

```bash
docker run --rm --network elibrary-mongo_elib-net \
  -v /home/dtnntd/csdl/final/scripts:/scripts \
  mongo:7.0 \
  mongosh --host mongos1:27020 elibrary /scripts/seed.js
```

## 5. Test Failover (Demo tắt container primary)

```bash
# Bước 1: Xác định primary của rsCity
PRIMARY=$(docker exec hn1 mongosh --port 27017 --quiet --eval "rs.isMaster().primary")
echo "Current primary: $PRIMARY"

# Bước 2: Lưu trạng thái RS TRƯỚC khi tắt
docker exec hn1 mongosh --port 27017 --quiet --eval 'rs.status().members.forEach(m => print(m.name + " - " + m.stateStr))' > /tmp/rs_before_failover.txt
cat /tmp/rs_before_failover.txt

# Bước 3: Mở terminal khác để monitor (chọn container KHÔNG phải primary)
# Terminal 2 - Monitor qua hp1 (hoặc dn1 nếu hp1 là primary):
watch -n 2 'docker exec hp1 mongosh --port 27018 --quiet --eval "rs.status().members.forEach(m => print(m.name + \" - \" + m.stateStr))" 2>/dev/null || echo "Waiting..."'

# Bước 4 (Terminal 1): Tắt container primary
# Giả sử primary là hn1:
docker stop hn1

# Quan sát terminal 2: Sau 10-15s, hp1 hoặc dn1 sẽ trở thành PRIMARY

# Bước 5: Đợi election hoàn tất
sleep 20

# Bước 6: Lưu trạng thái RS SAU khi failover (qua hp1)
docker exec hp1 mongosh --port 27018 --quiet --eval 'rs.status().members.forEach(m => print(m.name + " - " + m.stateStr))' > /tmp/rs_after_failover.txt
cat /tmp/rs_after_failover.txt

# Bước 7: Test connection vẫn hoạt động
echo "Testing if cluster still works..."
docker exec mongos1 mongosh --port 27020 elibrary --quiet --eval 'print("Books count:", db.books.countDocuments())'
docker exec mongos1 mongosh --port 27020 elibrary --quiet --eval 'print("Branches:", db.branches.find().toArray().map(b => b._id).join(", "))'

# Bước 8: Khởi động lại container hn1
docker start hn1
sleep 10

# Bước 9: Kiểm tra hn1 đã recovery và trở thành SECONDARY
docker exec hn1 mongosh --port 27017 --quiet --eval 'var status = rs.isMaster(); print("Is Secondary:", status.secondary); print("Current Primary:", status.primary)'

# Bước 10: So sánh kết quả trước/sau
echo -e "\n=== COMPARISON ==="
echo "Before failover:"
cat /tmp/rs_before_failover.txt
echo -e "\nAfter failover:"
cat /tmp/rs_after_failover.txt
```

**Script tự động test failover (chạy toàn bộ):**

```bash
cat > /home/dtnntd/csdl/final/scripts/test_failover.sh << 'EOF'
#!/bin/bash
set -e

echo "=========================================="
echo "MongoDB Failover Test"
echo "=========================================="

# 1. Check current primary
echo -e "\n1. Checking current primary..."
PRIMARY=$(docker exec hn1 mongosh --port 27017 --quiet --eval "rs.isMaster().primary" 2>/dev/null || echo "hn1:27017")
echo "Current primary: $PRIMARY"

# 2. Save state before
echo -e "\n2. Saving RS state before failover..."
docker exec hn1 mongosh --port 27017 --quiet --eval 'rs.status().members.forEach(m => print(m.name + " - " + m.stateStr))' 2>/dev/null > /tmp/rs_before.txt
cat /tmp/rs_before.txt

# 3. Stop primary (assume hn1)
echo -e "\n3. Stopping primary container (hn1)..."
docker stop hn1
echo "✓ hn1 stopped"

# 4. Wait for election
echo -e "\n4. Waiting for new primary election (20s)..."
for i in {1..20}; do
  echo -n "."
  sleep 1
done
echo ""

# 5. Check new state via hp1
echo -e "\n5. Checking new RS state..."
docker exec hp1 mongosh --port 27018 --quiet --eval 'rs.status().members.forEach(m => print(m.name + " - " + m.stateStr))' > /tmp/rs_after.txt
cat /tmp/rs_after.txt

NEW_PRIMARY=$(docker exec hp1 mongosh --port 27018 --quiet --eval "rs.isMaster().primary")
echo -e "\nNew primary: $NEW_PRIMARY"

# 6. Test cluster still works
echo -e "\n6. Testing cluster functionality..."
BOOK_COUNT=$(docker exec mongos1 mongosh --port 27020 elibrary --quiet --eval 'db.books.countDocuments()')
echo "Books count: $BOOK_COUNT"

if [ "$BOOK_COUNT" -gt 0 ]; then
  echo "✓ Cluster is still operational!"
else
  echo "✗ Cluster might have issues"
fi

# 7. Restart hn1
echo -e "\n7. Restarting hn1..."
docker start hn1
sleep 10

# 8. Check hn1 recovery
echo -e "\n8. Checking hn1 recovery..."
HN1_STATE=$(docker exec hn1 mongosh --port 27017 --quiet --eval 'rs.isMaster().secondary')
echo "hn1 is secondary: $HN1_STATE"

# 9. Final comparison
echo -e "\n=========================================="
echo "FAILOVER TEST COMPLETE"
echo "=========================================="
echo -e "\nBefore failover:"
cat /tmp/rs_before.txt
echo -e "\nAfter failover:"
cat /tmp/rs_after.txt
echo -e "\nhn1 recovered as secondary: $HN1_STATE"
echo "=========================================="
EOF

chmod +x /home/dtnntd/csdl/final/scripts/test_failover.sh

# Chạy script
/home/dtnntd/csdl/final/scripts/test_failover.sh
```

## 6. Benchmark hiệu năng (có/không index)

Tạo script benchmark:

```bash
cat > /home/dtnntd/csdl/final/bench/search_bench.js << 'EOF'
// Search benchmark: Full-text search with and without index

const conn = new Mongo("mongos1:27020");
const db = conn.getDB("elibrary");

// Test queries
const queries = [
  "Technology",
  "Science",
  "History",
  "Fiction",
  "Business"
];

function benchmark(label, hasIndex) {
  print(`\n========== ${label} ==========`);
  const results = [];
  
  for (let i = 0; i < 30; i++) {
    const query = queries[i % queries.length];
    const start = Date.now();
    
    db.books.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } }).limit(10).toArray();
    
    const duration = Date.now() - start;
    results.push(duration);
    
    if ((i + 1) % 10 === 0) {
      print(`  Completed ${i + 1}/30 queries...`);
    }
  }
  
  // Calculate statistics
  results.sort((a, b) => a - b);
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const p95 = results[Math.floor(results.length * 0.95)];
  const min = results[0];
  const max = results[results.length - 1];
  
  print(`\nResults:`);
  print(`  Runs: ${results.length}`);
  print(`  Avg:  ${avg.toFixed(2)} ms`);
  print(`  Min:  ${min} ms`);
  print(`  Max:  ${max} ms`);
  print(`  P95:  ${p95} ms`);
  
  return { label, hasIndex, results, avg, p95, min, max };
}

// Phase 1: WITH index (default state)
const withIndex = benchmark("WITH TEXT INDEX", true);

// Drop text index
print("\n>>> Dropping text index...");
try {
  db.books.dropIndex("title_text_authors_text_subjects_text_description_text");
  print("✓ Text index dropped");
} catch(e) {
  print("! Error dropping index: " + e.message);
}

// Wait a bit
sleep(2000);

// Phase 2: WITHOUT index
const withoutIndex = benchmark("WITHOUT TEXT INDEX", false);

// Recreate index
print("\n>>> Recreating text index...");
db.books.createIndex({ 
  title: "text", 
  authors: "text", 
  subjects: "text", 
  description: "text" 
});
print("✓ Text index recreated");

// Comparison
print("\n========================================");
print("COMPARISON:");
print("========================================");
print(`Without Index - Avg: ${withoutIndex.avg.toFixed(2)} ms, P95: ${withoutIndex.p95} ms`);
print(`With Index    - Avg: ${withIndex.avg.toFixed(2)} ms, P95: ${withIndex.p95} ms`);
print(`Improvement   - ${(withoutIndex.avg / withIndex.avg).toFixed(2)}x faster with index`);
print("========================================");

// Save results to collection
db.benchmarkResults.insertOne({
  timestamp: new Date(),
  withIndex: withIndex,
  withoutIndex: withoutIndex,
  improvement: withoutIndex.avg / withIndex.avg
});

print("\n✓ Results saved to elibrary.benchmarkResults");
EOF
```

Chạy benchmark:

```bash
docker run --rm --network elibrary-mongo_elib-net \
  -v /home/dtnntd/csdl/final/bench:/bench \
  mongo:7.0 \
  mongosh --host mongos1:27020 elibrary /bench/search_bench.js
```

## 7. Truy vấn nâng cao & Aggregation

```bash
# Full-text search
docker exec mongos1 mongosh --port 27020 elibrary --eval '
  db.books.find(
    { $text: { $search: "Technology Science" } },
    { score: { $meta: "textScore" }, title: 1, authors: 1 }
  ).sort({ score: { $meta: "textScore" } }).limit(5).pretty()
'

# Thống kê lượt mượn theo ngày
docker exec mongos1 mongosh --port 27020 elibrary --eval '
  db.transactions.aggregate([
    { $match: { type: "borrow" } },
    { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: 10 }
  ]).toArray()
'

# Top 10 sách được mượn nhiều nhất
docker exec mongos1 mongosh --port 27020 elibrary --eval '
  db.loans.aggregate([
    { $group: { _id: "$copyId", borrowCount: { $sum: 1 } } },
    { $sort: { borrowCount: -1 } },
    { $limit: 10 },
    { $lookup: {
        from: "copies",
        localField: "_id",
        foreignField: "_id",
        as: "copy"
      }
    },
    { $unwind: "$copy" },
    { $lookup: {
        from: "books",
        localField: "copy.bookId",
        foreignField: "_id",
        as: "book"
      }
    },
    { $unwind: "$book" },
    { $project: {
        bookTitle: "$book.title",
        borrowCount: 1
      }
    }
  ]).toArray()
'

# Thống kê theo chi nhánh
docker exec mongos1 mongosh --port 27020 elibrary --eval '
  db.transactions.aggregate([
    { $match: { type: "borrow" } },
    { $group: {
        _id: "$branchId",
        totalBorrows: { $sum: 1 }
      }
    },
    { $sort: { totalBorrows: -1 } }
  ]).toArray()
'
```

## 8. Kiểm tra phân bố dữ liệu trên các shard

```bash
# Xem chunk distribution
docker exec mongos1 mongosh --port 27020 elibrary --eval '
  db.copies.getShardDistribution()
'

docker exec mongos1 mongosh --port 27020 elibrary --eval '
  db.loans.getShardDistribution()
'

docker exec mongos1 mongosh --port 27020 elibrary --eval '
  db.transactions.getShardDistribution()
'

# Xem chi tiết chunks
docker exec mongos1 mongosh --port 27020 config --eval '
  db.chunks.find({ ns: "elibrary.copies" }).pretty()
'
```

## 9. Export kết quả để đưa vào báo cáo

```bash
# Export shard status
docker exec mongos1 mongosh --port 27020 --eval 'sh.status()' > /home/dtnntd/csdl/final/report/shard_status.txt

# Export RS status
docker exec hn1 mongosh --port 27017 --eval 'rs.status()' > /home/dtnntd/csdl/final/report/rs_status.txt

# Export benchmark results
docker exec mongos1 mongosh --port 27020 elibrary --quiet --eval '
  db.benchmarkResults.find().sort({timestamp: -1}).limit(1).pretty()
' > /home/dtnntd/csdl/final/report/benchmark_results.txt

# Screenshot sh.status() (dùng script hoặc manual)
# Screenshot rs.status() before/after failover
```

## 10. Dọn dẹp (khi hoàn thành)

```bash
# Stop all containers
cd /home/dtnntd/csdl/final/deloy
docker compose down

# Remove volumes (WARNING: xóa hết dữ liệu)
docker compose down -v

# Remove images (nếu cần)
docker rmi mongo:7.0
```

## 11. Troubleshooting

```bash
# Kiểm tra logs
docker compose logs -f mongos1
docker compose logs -f hn1

# Restart một service
docker compose restart mongos1

# Exec vào container
docker exec -it mongos1 bash

# Kiểm tra network
docker network inspect elibrary-mongo_elib-net

# Kiểm tra volumes
docker volume ls | grep elibrary
```

## Checklist thực hiện

- [ ] Khởi động cluster thành công (tất cả containers healthy)
- [ ] Config RS và Shard RS đã initiate
- [ ] Sharding enabled cho database elibrary
- [ ] 3 collections đã sharded: transactions, loans, copies
- [ ] Seed ~10k records thành công
- [ ] Phân bố đều dữ liệu trên 3 branches (HN/HP/DN)
- [ ] Test failover: tắt primary, cluster vẫn hoạt động
- [ ] Benchmark có/không index (có sự khác biệt rõ ràng)
- [ ] Full-text search hoạt động
- [ ] Aggregation pipelines chạy đúng
- [ ] Export kết quả + screenshot cho báo cáo
