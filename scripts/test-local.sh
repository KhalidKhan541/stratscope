#!/bin/bash
set -e

echo "=== StratScope Local Testing ==="

echo "Starting API server..."
cd apps/api
pnpm dev:local &
API_PID=$!
cd ../..

echo "Waiting for API to start..."
sleep 8

echo "Running API tests..."
cd apps/api
pnpm test:local
cd ../..

echo "Stopping API..."
kill $API_PID 2>/dev/null || true
wait $API_PID 2>/dev/null || true

echo "=== Testing Complete ==="
