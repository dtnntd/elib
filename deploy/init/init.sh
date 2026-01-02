#!/bin/bash
set -e

echo "=========================================="
echo "Starting MongoDB Sharded Cluster Setup"
echo "=========================================="

# -----------------------------
# 1. Initiate Shard1 RS (rsCity)
# -----------------------------
echo ""
echo ">>> Initiating Shard1 Replica Set (rsCity)..."
STATUS=$(mongosh --host hn1:27017 --quiet --eval "rs.status().ok" 2>&1 || echo "false")
if [[ "$STATUS" != "1" ]]; then
  mongosh --host hn1:27017 --quiet --eval '
    rs.initiate({
      _id: "rsCity",
      members: [
        { _id: 0, host: "hn1:27017", priority: 2 },
        { _id: 1, host: "hp1:27018", priority: 1 },
        { _id: 2, host: "dn1:27019", priority: 1 }
      ]
    });
  '
  echo "✓ rsCity initiated with hn1 priority=2"
else
  echo "✓ rsCity already initiated"
fi

# Wait for rsCity to elect primary
echo "Waiting for rsCity primary election..."
sleep 10

# -----------------------------
# 2. Initiate Shard2 RS (rsExtra)
# -----------------------------
echo ""
echo ">>> Initiating Shard2 Replica Set (rsExtra)..."
STATUS=$(mongosh --host ex1:27217 --quiet --eval "rs.status().ok" 2>&1 || echo "false")
if [[ "$STATUS" != "1" ]]; then
  mongosh --host ex1:27217 --quiet --eval '
    rs.initiate({
      _id: "rsExtra",
      members: [
        { _id: 0, host: "ex1:27217" },
        { _id: 1, host: "ex2:27218" }
      ]
    });
  '
  echo "✓ rsExtra initiated"
else
  echo "✓ rsExtra already initiated"
fi

# Wait for rsExtra to elect primary
echo "Waiting for rsExtra primary election..."
sleep 10

# -----------------------------
# 3. Add Shards to mongos
# -----------------------------
echo ""
echo ">>> Adding shards to cluster..."
mongosh --host mongos1:27020 --quiet --eval '
  var shards = sh.status().shards || [];
  var hasRsCity = shards.some(s => s._id === "rsCity");
  var hasRsExtra = shards.some(s => s._id === "rsExtra");
  
  if (!hasRsCity) {
    sh.addShard("rsCity/hn1:27017,hp1:27018,dn1:27019");
    print("✓ rsCity shard added");
  } else {
    print("✓ rsCity shard already exists");
  }
  
  if (!hasRsExtra) {
    sh.addShard("rsExtra/ex1:27217,ex2:27218");
    print("✓ rsExtra shard added");
  } else {
    print("✓ rsExtra shard already exists");
  }
'

# -----------------------------
# 4. Enable Sharding on Database
# -----------------------------
echo ""
echo ">>> Enabling sharding on 'elibrary' database..."
mongosh --host mongos1:27020 --quiet --eval '
  sh.enableSharding("elibrary");
  print("✓ Sharding enabled on elibrary");
'

# -----------------------------
# 5. Create Collections and Shard them
# -----------------------------
echo ""
echo ">>> Creating and sharding collections..."
mongosh --host mongos1:27020 elibrary --quiet --eval '
  // Create collections
  db.createCollection("branches");
  db.createCollection("books");
  db.createCollection("physical_copies");
  db.createCollection("digital_licenses");
  db.createCollection("members");
  db.createCollection("loans");
  db.createCollection("events");
  print("✓ Collections created");
'

mongosh --host mongos1:27020 --quiet --eval '
  try {
    sh.shardCollection("elibrary.events", { branchId: 1, occurredAt: 1 });
    print("✓ events sharded");
  } catch(e) {
    print("! events already sharded: " + e.message);
  }
  
  try {
    sh.shardCollection("elibrary.loans", { branchId: 1, borrowedAt: 1 });
    print("✓ loans sharded");
  } catch(e) {
    print("! loans already sharded: " + e.message);
  }
  
  try {
    // Physical copies: Shard by branchId + _id (Branch locality)
    sh.shardCollection("elibrary.physical_copies", { branchId: 1, _id: 1 });
    print("✓ physical_copies sharded");
  } catch(e) {
    print("! physical_copies already sharded: " + e.message);
  }

  try {
    // Digital licenses: Global hashed sharding (or branch if scoped)
    // plan.md suggested { branchId: 1, _id: 1 } or hashed. Let us use hashed(_id) for global distribution demo
    // But since plan.md explicitly discussed branch scope for licenses too, let us stick to branchId for consistency first,
    // OR allow hashed. plan.md says: "Nếu license toàn hệ thống: hashed(_id)". 
    // Let us use hashed(_id) to demonstrate a different sharding strategy.
    sh.shardCollection("elibrary.digital_licenses", { _id: "hashed" });
    print("✓ digital_licenses sharded (hashed)");
  } catch(e) {
    print("! digital_licenses already sharded: " + e.message);
  }
'

# -----------------------------
# 6. Create Indexes
# -----------------------------
echo ""
echo ">>> Creating indexes..."
mongosh --host mongos1:27020 elibrary --quiet --eval '
  // Books indexes
  db.books.createIndex({ title: "text", authors: "text", subjects: "text", description: "text" });
  db.books.createIndex({ isbn: 1 }, { unique: true });
  
  // Physical Copies indexes
  db.physical_copies.createIndex({ branchId: 1, status: 1 });
  db.physical_copies.createIndex({ barcode: 1 }, { unique: true }); // Global unique barcode
  db.physical_copies.createIndex({ bookId: 1 });
  
  // Digital Licenses indexes
  db.digital_licenses.createIndex({ bookId: 1 });
  db.digital_licenses.createIndex({ vendor: 1 });
  
  // Members indexes
  db.members.createIndex({ email: 1 }, { unique: true });
  db.members.createIndex({ branchId: 1 });
  
  // Loans indexes
  db.loans.createIndex({ branchId: 1, status: 1, borrowedAt: -1 });
  db.loans.createIndex({ memberId: 1, status: 1 });
  db.loans.createIndex({ itemType: 1, status: 1 }); // Support E-book vs Physical lookup
  
  // Events indexes (formerly transactions)
  db.events.createIndex({ branchId: 1, occurredAt: -1 });
  db.events.createIndex({ memberId: 1 });
  db.events.createIndex({ type: 1 });
  
  // Branches indexes
  db.branches.createIndex({ city: 1 }, { unique: true });
  
  print("✓ Indexes created");
'

# -----------------------------
# 7. Insert initial branch data
# -----------------------------
echo ""
echo ">>> Inserting initial branch data..."
mongosh --host mongos1:27020 elibrary --quiet --eval '
  var count = db.branches.countDocuments();
  if (count === 0) {
    db.branches.insertMany([
      { _id: "HN", city: "Hanoi", name: "Thư viện Hà Nội" },
      { _id: "HP", city: "Haiphong", name: "Thư viện Hải Phòng" },
      { _id: "DN", city: "Danang", name: "Thư viện Đà Nẵng" }
    ]);
    print("✓ Branch data inserted");
  } else {
    print("✓ Branch data already exists");
  }
'

echo ""
echo "=========================================="
echo "✓ MongoDB Sharded Cluster Setup Complete!"
echo "=========================================="
echo ""
echo "Connect to mongos: mongosh --host localhost --port 27020"
echo "Check shard status: mongosh --host localhost --port 27020 --eval 'sh.status()'"
echo ""
