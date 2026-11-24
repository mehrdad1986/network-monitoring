#!/bin/bash
echo "=== NetMon API Endpoint Tests ==="
echo ""

# Start server in background
/d/netmon/backend/server &
SERVER_PID=$!
sleep 2

# Test core endpoints
ENDPOINTS=(
  "/api/v1/tools/ping"
  "/api/v1/tools/traceroute"
  "/api/v1/tools/latency-measure"
  "/api/v1/tools/throughput-analysis"
  "/api/v1/tools/quality-analysis"
  "/api/v1/tools/sla-monitoring"
  "/api/v1/tools/packet-capture"
  "/api/v1/tools/http-check"
)

PASS=0
FAIL=0

for endpoint in "${ENDPOINTS[@]}"; do
  RESPONSE=$(curl -s -X POST http://localhost:8080${endpoint} \
    -H "Content-Type: application/json" \
    -d '{"target":"example.com"}' -w "%{http_code}" -o /tmp/response.json)
  
  if [ "$RESPONSE" == "200" ]; then
    echo "✅ ${endpoint}"
    ((PASS++))
  else
    echo "❌ ${endpoint} (HTTP $RESPONSE)"
    ((FAIL++))
  fi
done

echo ""
echo "Results: $PASS passed, $FAIL failed"

# Cleanup
kill $SERVER_PID 2>/dev/null
exit $FAIL
