# Kiến trúc MongoDB Sharded Cluster - e-Library

## Tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION/CLIENT                      │
│                    (MongoDB Compass, App)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │   MONGOS (Router)    │ ← mongos1:27020
              │   Query Router       │
              └──────────┬───────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌────────────────┐ ┌─────────────┐ ┌──────────────┐
│   SHARD 1      │ │   SHARD 2   │ │ CONFIG RS    │
│   (rsCity)     │ │   (rsExtra) │ │   (cfgRS)    │
│                │ │             │ │              │
│  hn1 PRIMARY   │ │  ex1 PRIMARY│ │  cfg1 PRIMARY│
│  hp1 SECONDARY │ │  ex2 SECONDARY│  cfg2 SECONDARY│
│  dn1 SECONDARY │ │             │ │  cfg3 SECONDARY│
└────────────────┘ └─────────────┘ └──────────────┘
```

---

## 1. MONGOS - Router (mongos1:27020)

**Vai trò:** Cổng vào chính của cluster

**Nhiệm vụ:**
- ✅ Nhận query từ client (Compass, application)
- ✅ **Query routing**: Phân tích query và route đến shard phù hợp
- ✅ **Merge kết quả**: Gom kết quả từ nhiều shard về
- ✅ **Load balancing**: Phân tán query đều các shard
- ✅ Không lưu data, chỉ routing

**Ví dụ:**
```javascript
// Client gửi query:
db.copies.find({ barcode: "BC100000" })

// mongos tự động:
// 1. Xem shard key của copies là {barcode: 1}
// 2. Route đến đúng shard chứa barcode này
// 3. Trả kết quả về client
```

**Port:** 27020 (kết nối từ Compass qua đây)

---

## 2. SHARD 1 - rsCity (hn1, hp1, dn1)

**Vai trò:** Shard chính - Lưu dữ liệu theo địa phương (3 thành phố)

### hn1 (Hà Nội) - Port 27017
- **Role:** PRIMARY (priority: 2 - cao nhất)
- **Nhiệm vụ:**
  - ✅ Nhận tất cả write operations (INSERT, UPDATE, DELETE)
  - ✅ Xử lý read operations
  - ✅ Replicate dữ liệu sang hp1 và dn1
  - ✅ Tự động lấy lại PRIMARY khi restart (do priority cao)

### hp1 (Hải Phòng) - Port 27018
- **Role:** SECONDARY (priority: 1)
- **Nhiệm vụ:**
  - ✅ Sao lưu dữ liệu từ PRIMARY
  - ✅ Xử lý read operations (nếu config readPreference=secondary)
  - ✅ **Failover**: Lên PRIMARY tạm thời khi hn1 chết
  - ✅ Quay về SECONDARY khi hn1 sống lại

### dn1 (Đà Nẵng) - Port 27019
- **Role:** SECONDARY (priority: 1)
- **Nhiệm vụ:** Giống hp1

**Dữ liệu lưu trữ:**
- Branches có branchId = "HN", "HP", "DN"
- Copies với barcode được phân bổ đều
- Loans/Transactions của 3 chi nhánh này

**Tại sao 3 nodes?**
- ✅ High Availability: 1 chết vẫn hoạt động
- ✅ Geographic distribution: Mô phỏng 3 thành phố
- ✅ Majority voting: Cần ít nhất 2/3 nodes để elect PRIMARY

---

## 3. SHARD 2 - rsExtra (ex1, ex2)

**Vai trò:** Shard bổ sung - Mở rộng capacity

### ex1 - Port 27217
- **Role:** PRIMARY
- **Nhiệm vụ:** Nhận writes, xử lý reads, replicate sang ex2

### ex2 - Port 27218
- **Role:** SECONDARY
- **Nhiệm vụ:** Backup từ ex1, failover khi cần

**Dữ liệu lưu trữ:**
- Copies với barcode trong range khác
- Loans/Transactions của các chi nhánh khác (nếu có)
- Data overflow khi rsCity đầy

**Tại sao cần Shard 2?**
- ✅ **Horizontal scaling**: Tăng capacity lưu trữ
- ✅ **Performance**: Phân tán load queries
- ✅ **Flexibility**: Dễ thêm chi nhánh mới (VT, CT, HCM...)

**Khi nào dùng ex1/ex2?**
- Khi số lượng copies tăng lên > 1 triệu
- Khi cần thêm branches mới không thuộc HN/HP/DN
- Khi rsCity quá tải

---

## 4. CONFIG SERVERS - cfgRS (cfg1, cfg2, cfg3)

**Vai trò:** "Bộ não" của cluster - Lưu metadata

### cfg1 - Port 27117 (PRIMARY)
### cfg2 - Port 27118 (SECONDARY)
### cfg3 - Port 27119 (SECONDARY)

**Nhiệm vụ:**
- ✅ **Lưu metadata cluster:**
  - Danh sách shards (rsCity, rsExtra)
  - Shard key của từng collection
  - Chunk ranges và distribution
  - Collection sharding status
  
- ✅ **Chunk balancing:**
  - Theo dõi kích thước chunks
  - Trigger auto-balancing khi cần
  - Di chuyển chunks giữa các shard

- ✅ **Cluster coordination:**
  - Đảm bảo consistency
  - Phối hợp giữa mongos và shards
  - Lock mechanism cho distributed operations

**Dữ liệu config quan trọng:**
```javascript
// config.shards - Danh sách shards
{ _id: "rsCity", host: "rsCity/hn1:27017,hp1:27018,dn1:27019" }
{ _id: "rsExtra", host: "rsExtra/ex1:27217,ex2:27218" }

// config.databases - Databases đã sharded
{ _id: "elibrary", partitioned: true, primary: "rsCity" }

// config.collections - Collections đã sharded
{ _id: "elibrary.copies", key: { barcode: 1 }, unique: false }
{ _id: "elibrary.loans", key: { branchId: 1, borrowedAt: 1 } }

// config.chunks - Phân bố dữ liệu
{ ns: "elibrary.copies", min: { barcode: MinKey }, max: { barcode: "BC150000" }, shard: "rsCity" }
{ ns: "elibrary.copies", min: { barcode: "BC150000" }, max: { barcode: MaxKey }, shard: "rsExtra" }
```

**Tại sao cần 3 config servers?**
- ✅ **Redundancy**: 1-2 chết vẫn hoạt động
- ✅ **Consistency**: Majority voting (2/3)
- ✅ **Critical data**: Config data QUAN TRỌNG NHẤT, mất = mất toàn bộ cluster

⚠️ **LƯU Ý:** Nếu mất config servers → cluster không khởi động được!

---

## 5. Luồng hoạt động

### Write Operation:
```
Client → mongos1 → rsCity (hn1 PRIMARY) → replicate → hp1, dn1
                ↓
         Update config chunks in cfg1
```

### Read Operation (với shard key):
```
Client → mongos1 → Check config → Route to correct shard → Return data
```

### Read Operation (không có shard key - scatter-gather):
```
Client → mongos1 → Query ALL shards (rsCity + rsExtra) → Merge results → Return
```

### Failover:
```
hn1 crashes → hp1/dn1 detect (10s) → Vote new PRIMARY → hp1 elected
              ↓
         mongos1 auto-detect → Route writes to hp1
              ↓
         hn1 restarts → Sync data → Reclaim PRIMARY (priority 2)
```

---

## 6. Tóm tắt vai trò

| Component | Vai trò | Lưu data? | Critical? |
|-----------|---------|-----------|-----------|
| **mongos1** | Router | ❌ | Trung bình (có thể có nhiều mongos) |
| **hn1/hp1/dn1** | Shard 1 - Data storage | ✅ | Cao (mất data nếu mất cả RS) |
| **ex1/ex2** | Shard 2 - Data storage | ✅ | Cao (mất data nếu mất cả RS) |
| **cfg1/cfg2/cfg3** | Metadata storage | ✅ | **CỰC KỲ CAO** (mất = cluster chết) |

---

## 7. Demo thực tế

### Xem config metadata:
```bash
# Xem danh sách shards
docker exec mongos1 mongosh --port 27020 config --eval "db.shards.find().pretty()"

# Xem chunks distribution
docker exec mongos1 mongosh --port 27020 config --eval "db.chunks.find({ ns: 'elibrary.copies' }).pretty()"

# Xem shard status tổng quan
docker exec mongos1 mongosh --port 27020 --eval "sh.status()"
```

### Test routing:
```bash
# Insert vào shard cụ thể
docker exec mongos1 mongosh --port 27020 elibrary --eval '
  db.copies.insertOne({
    _id: "TEST1",
    bookId: "BK000001", 
    branchId: "HN",
    barcode: "BC999999",  // Sẽ route đến shard chứa range này
    status: "available"
  })
'

# Xem data đã nằm ở shard nào
docker exec mongos1 mongosh --port 27020 elibrary --eval '
  db.copies.find({ barcode: "BC999999" }).explain("executionStats")
' | grep -E "shardName|nReturned"
```

---

## 8. Kịch bản mở rộng

### Thêm chi nhánh Vũng Tàu:
1. Insert branch VT → tự động vào rsCity hoặc rsExtra
2. Copies của VT sẽ được balance tự động giữa 2 shards
3. Không cần config gì thêm!

### Thêm Shard 3 (khi quá tải):
1. Setup rsNew (3 nodes mới)
2. `sh.addShard("rsNew/node1:port,node2:port,node3:port")`
3. MongoDB tự động rebalance chunks sang shard mới

### Tăng capacity:
- Không cần shard mới → Thêm node vào RS hiện tại
- Ví dụ: Thêm dn2:27020 vào rsCity → Tăng redundancy

---

## 9. Best Practices

✅ **Luôn kết nối qua mongos** - Không direct connect đến shard  
✅ **Backup config servers thường xuyên** - Quan trọng nhất  
✅ **Monitor chunk distribution** - Tránh hotspot  
✅ **Set priority cho PRIMARY node** - Auto failback  
✅ **Dùng replica set cho mỗi shard** - High availability  

---

**Tài liệu khác:**
- [COMMANDS.md](COMMANDS.md) - Các lệnh thực thi
- [MONGODB_COMPASS.md](MONGODB_COMPASS.md) - Kết nối Compass
- [plan.md](../plan.md) - Kế hoạch tổng thể
