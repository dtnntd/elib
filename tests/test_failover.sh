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
