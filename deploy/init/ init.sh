

#!/usr/bin/env bash
set -euo pipefail

echo "==> Waiting for mongod/mongos to be reachable..."

wait_for() {
  local host="$1"
  local port="$2"
  local name="${3:-$host:$port}"
  for i in $(seq 1 120); do
    if mongosh --quiet --host "$host" --port "$port" --eval 'db.adminCommand("ping").ok' 2>/dev/null | grep 1 >/dev/null; then
      echo "==> OK: $name"
      return 0
    fi
    sleep 2
  done
  echo "!! Timeout waiting for $name"
  exit 1
}

wait_for cfg1 27117 "cfg1"
wait_for cfg2 27118 "cfg2"
wait_for cfg3 27119 "cfg3"
wait_for hn1 27017 "hn1"
wait_for hp1 27018 "hp1"
wait_for dn1 27019 "dn1"
wait_for ex1 27217 "ex1"
wait_for ex2 27218 "ex2"
wait_for mongos1 27020 "mongos1"

echo "==> Initiate cfgRS (Config Server Replica Set)"
mongosh --quiet --host cfg1 --port 27117 <<'JS'
try {
  rs.status();
  print("cfgRS already initiated.");
} catch (e) {
  rs.initiate({
    _id: "cfgRS",
    configsvr: true,
    members: [
      { _id: 0, host: "cfg1:27117" },
      { _id: 1, host: "cfg2:27118" },
      { _id: 2, host: "cfg3:27119" }
    ]
  });
  print("cfgRS initiated.");
}
JS

echo "==> Initiate rsCity (HN/HP/DN shard replica set)"
mongosh --quiet --host hn1 --port 27017 <<'JS'
try {
  rs.status();
  print("rsCity already initiated.");
} catch (e) {
  rs.initiate({
    _id: "rsCity",
    members: [
      { _id: 0, host: "hn1:27017", priority: 2 },
      { _id: 1, host: "hp1:27018", priority: 1 },
      { _id: 2, host: "dn1:27019", priority: 1 }
    ]
  });
  print("rsCity initiated.");
}
JS

echo "==> Initiate rsExtra (secondary shard replica set)"
mongosh --quiet --host ex1 --port 27217 <<'JS'
try {
  rs.status();
  print("rsExtra already initiated.");
} catch (e) {
  rs.initiate({
    _id: "rsExtra",
    members: [
      { _id: 0, host: "ex1:27217", priority: 1 },
      { _id: 1, host: "ex2:27218", priority: 1 }
    ]
  });
  print("rsExtra initiated.");
}
JS

echo "==> Wait a bit for replica sets to settle..."
sleep 8

echo "==> Add shards to mongos (sharded cluster)"
mongosh --quiet --host mongos1 --port 27020 <<'JS'
function safeAddShard(connStr) {
  try {
    const res = sh.addShard(connStr);
    printjson(res);
  } catch (e) {
    print("addShard skipped/failed (maybe already added): " + connStr);
    print(e);
  }
}

safeAddShard("rsCity/hn1:27017,hp1:27018,dn1:27019");
safeAddShard("rsExtra/ex1:27217,ex2:27218");

print("==> Enable sharding for DB eLibrary");
try { sh.enableSharding("eLibrary"); } catch(e) { print("enableSharding skipped: " + e); }

JS

echo "==> Create indexes + shard collections with required shard keys"
mongosh --quiet --host mongos1 --port 27020 <<'JS'
use eLibrary;

// 1) transactions: shard key {branchId, createdAt}
db.transactions.createIndex({ branchId: 1, createdAt: 1 });
try {
  sh.shardCollection("eLibrary.transactions", { branchId: 1, createdAt: 1 });
} catch (e) {
  print("transactions already sharded (or error): " + e);
}

// 2) loans: shard key {branchId, borrowedAt}
db.loans.createIndex({ branchId: 1, borrowedAt: 1 });
try {
  sh.shardCollection("eLibrary.loans", { branchId: 1, borrowedAt: 1 });
} catch (e) {
  print("loans already sharded (or error): " + e);
}

// 3) copies: shard key {branchId, _id}
db.copies.createIndex({ branchId: 1, _id: 1 });
try {
  sh.shardCollection("eLibrary.copies", { branchId: 1, _id: 1 });
} catch (e) {
  print("copies already sharded (or error): " + e);
}

// Full-text index cho books (không shard books ở giai đoạn đầu)
db.books.createIndex({
  title: "text",
  authors: "text",
  subjects: "text",
  description: "text"
});

// Optional: seed 3 branches tối giản (nếu bạn quyết định dùng collection branches)
db.branches.updateOne({ _id: "HN" }, { $set: { city: "Hà Nội", name: "Cơ sở Hà Nội" } }, { upsert: true });
db.branches.updateOne({ _id: "HP" }, { $set: { city: "Hải Phòng", name: "Cơ sở Hải Phòng" } }, { upsert: true });
db.branches.updateOne({ _id: "DN" }, { $set: { city: "Đà Nẵng", name: "Cơ sở Đà Nẵng" } }, { upsert: true });

print("==> DONE: indexes + sharding + text index");
JS

echo "==> Show sharding status (quick proof)"
mongosh --quiet --host mongos1 --port 27020 --eval 'sh.status()'

echo "==> Init complete."
