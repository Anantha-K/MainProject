#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8088}"

echo "Checking system health..."
curl -s "${BASE_URL}/api/v1/system/health" | python3 -m json.tool

echo
echo "Flushing cache..."
curl -s -X POST "${BASE_URL}/api/v1/system/cache/flush" -o /dev/null -w "status=%{http_code}\n"

echo
echo "Cold burst request..."
for _ in 1 2 3; do
  curl -s -X POST "${BASE_URL}/api/v1/orchestration/execute" \
    -H "Content-Type: application/json" \
    -d '{"tenantId":"team-a","functionName":"traffic-score","payload":{"location":"seattle"},"metadata":{"source":"smoke-test"}}' &
done
wait

echo
echo "Warm cache request..."
curl -s -X POST "${BASE_URL}/api/v1/orchestration/execute" \
  -H "Content-Type: application/json" \
  -d '{"tenantId":"team-a","functionName":"traffic-score","payload":{"location":"seattle"},"metadata":{"source":"smoke-test"}}' | python3 -m json.tool
