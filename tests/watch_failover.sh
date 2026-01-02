#!/bin/bash

# Script để watch real-time trạng thái replica set
# Chỉ hiển thị khi có thay đổi

echo "Watching rsCity status via hp1..."
echo "Press Ctrl+C to stop"
echo "Only shows when state changes detected"
echo "=========================================="
echo ""

PREV_STATE=""

while true; do
  # Lấy trạng thái hiện tại
  CURRENT_STATE=$(docker exec hp1 mongosh --port 27018 --quiet --eval "
    var cfg = rs.conf();
    var primary = rs.isMaster().primary;
    var state = 'PRIMARY:' + primary + '|';
    rs.status().members.forEach(m => {
      var priority = cfg.members.find(x => x.host === m.name).priority;
      state += m.name + ':' + m.stateStr + ':' + priority + '|';
    });
    print(state);
  " 2>/dev/null)
  
  # So sánh với trạng thái trước đó
  if [ "$CURRENT_STATE" != "$PREV_STATE" ] && [ -n "$CURRENT_STATE" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔔 CHANGE DETECTED at $(date '+%Y-%m-%d %H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Lấy thông tin PRIMARY
    PRIMARY=$(docker exec hp1 mongosh --port 27018 --quiet --eval "rs.isMaster().primary" 2>/dev/null || echo "N/A")
    echo "PRIMARY: $PRIMARY"
    echo ""
    
    # Hiển thị trạng thái từng member
    docker exec hp1 mongosh --port 27018 --quiet --eval "
      var cfg = rs.conf();
      rs.status().members.forEach(m => {
        var priority = cfg.members.find(x => x.host === m.name).priority;
        print('  ' + m.name + ' - ' + m.stateStr + ' (priority: ' + priority + ')');
      });
    " 2>/dev/null
    
    echo ""
    
    PREV_STATE="$CURRENT_STATE"
  fi
  
  sleep 2
done
