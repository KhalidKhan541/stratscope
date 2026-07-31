#!/bin/bash
set -e

echo "=== StratScope Integration Test ==="

echo "Starting API..."
cd apps/api
pnpm dev &
API_PID=$!
cd ../..

echo "Waiting for API..."
sleep 5

echo "Running integration tests..."
pnpm test:integration:run

kill $API_PID 2>/dev/null || true

echo "=== Integration Test Complete ==="
