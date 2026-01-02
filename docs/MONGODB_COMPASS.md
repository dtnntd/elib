# Kết nối MongoDB Compass

## 1. Khởi động lại để expose đầy đủ ports

```bash
cd /home/dtnntd/csdl/final/deloy
docker compose restart
```

## 2. Connection Strings

### ⭐ KẾT NỐI CHÍNH - Qua MONGOS (Khuyến nghị)

**Connection String:**
```
mongodb://localhost:27020/
```

**Hoặc kết nối đến database elibrary:**
```
mongodb://localhost:27020/elibrary
```

- Đây là cách **TỐT NHẤT** để xem toàn bộ sharded cluster
- Tự động routing đến shard phù hợp
- Xem được tất cả collections: branches, books, copies, members, loans, transactions

---

### Kết nối đến từng Replica Set (Nâng cao)

#### Shard1 - rsCity (HN/HP/DN)

**PRIMARY (hn1):**
```
mongodb://localhost:27017/?directConnection=true
```

**SECONDARY (hp1):**
```
mongodb://localhost:27018/?directConnection=true
```

**SECONDARY (dn1):**
```
mongodb://localhost:27019/?directConnection=true
```

**Replica Set Connection (tất cả members):**
```
mongodb://localhost:27017,localhost:27018,localhost:27019/?replicaSet=rsCity
```

---

#### Shard2 - rsExtra

**PRIMARY (ex1):**
```
mongodb://localhost:27217/?directConnection=true
```

**SECONDARY (ex2):**
```
mongodb://localhost:27218/?directConnection=true
```

**Replica Set Connection:**
```
mongodb://localhost:27217,localhost:27218/?replicaSet=rsExtra
```

---

#### Config Servers - cfgRS

**Config Server 1:**
```
mongodb://localhost:27117/?directConnection=true
```

**Config Server 2:**
```
mongodb://localhost:27118/?directConnection=true
```

**Config Server 3:**
```
mongodb://localhost:27119/?directConnection=true
```

---

## 3. Cách sử dụng MongoDB Compass

### Bước 1: Mở MongoDB Compass

### Bước 2: Nhập Connection String
- Chọn "New Connection"
- Paste: `mongodb://localhost:27020/`
- Click "Connect"

### Bước 3: Xem dữ liệu
- Database: `elibrary`
- Collections: 
  - `branches` - Thông tin chi nhánh
  - `books` - Danh sách sách
  - `copies` - Bản sao sách (sharded by barcode)
  - `members` - Thành viên
  - `loans` - Mượn sách (sharded by branchId, borrowedAt)
  - `transactions` - Giao dịch (sharded by branchId, createdAt)

### Bước 4: Query ví dụ

**Tìm sách theo text search:**
```javascript
{ $text: { $search: "Technology" } }
```

**Tìm loans theo chi nhánh:**
```javascript
{ branchId: "HN" }
```

**Tìm transactions trong khoảng thời gian:**
```javascript
{ 
  createdAt: { 
    $gte: ISODate("2024-01-01"), 
    $lte: ISODate("2024-12-31") 
  } 
}
```

---

## 4. Xem Shard Distribution trong Compass

1. Kết nối đến `mongodb://localhost:27020/`
2. Vào database `config`
3. Xem collections:
   - `shards` - Danh sách shards
   - `databases` - Databases đã sharded
   - `chunks` - Phân bố chunks
   - `collections` - Collections đã sharded

---

## 5. Lệnh terminal để xem nhanh

```bash
# Xem tất cả databases
docker exec mongos1 mongosh --port 27020 --quiet --eval "db.adminCommand('listDatabases')"

# Xem collections trong elibrary
docker exec mongos1 mongosh --port 27020 elibrary --quiet --eval "db.getCollectionNames()"

# Count documents
docker exec mongos1 mongosh --port 27020 elibrary --quiet --eval "
  print('branches:', db.branches.countDocuments());
  print('books:', db.books.countDocuments());
  print('copies:', db.copies.countDocuments());
  print('members:', db.members.countDocuments());
  print('loans:', db.loans.countDocuments());
  print('transactions:', db.transactions.countDocuments());
"

# Xem một vài documents
docker exec mongos1 mongosh --port 27020 elibrary --quiet --eval "db.branches.find().pretty()"
docker exec mongos1 mongosh --port 27020 elibrary --quiet --eval "db.books.find().limit(3).pretty()"

# Xem shard distribution
docker exec mongos1 mongosh --port 27020 elibrary --quiet --eval "db.copies.getShardDistribution()"
```

---

## 6. Troubleshooting

### Nếu không kết nối được:

```bash
# Kiểm tra containers đang chạy
docker compose ps

# Kiểm tra ports
docker compose ps --format "table {{.Name}}\t{{.Ports}}"

# Kiểm tra logs
docker compose logs mongos1

# Test connection từ terminal
docker exec mongos1 mongosh --port 27020 --eval "db.adminCommand('ping')"
```

### Nếu thấy "Connection refused":

```bash
# Restart containers
cd /home/dtnntd/csdl/final/deloy
docker compose restart
```

---

## 7. So sánh kết nối trực tiếp vs qua mongos

| Phương pháp | Ưu điểm | Nhược điểm |
|-------------|---------|------------|
| **Qua mongos (27020)** | ✅ Xem toàn bộ cluster<br>✅ Query tự động routing<br>✅ Aggregation cross-shard | ❌ Không thấy từng shard riêng |
| **Trực tiếp shard (27017, 27217)** | ✅ Xem dữ liệu của 1 shard<br>✅ Debug phân bố | ❌ Chỉ thấy dữ liệu local<br>❌ Không thấy toàn bộ |

**Khuyến nghị:** Dùng mongos (port 27020) cho hầu hết các trường hợp.
