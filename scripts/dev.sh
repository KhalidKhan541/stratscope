#!/bin/bash
set -e

echo "=== StratScope Development ==="

if [ -f "scripts/validate-env.sh" ]; then
    bash scripts/validate-env.sh
fi

echo "Starting API..."
pnpm --filter @stratscope/api dev &
API_PID=$!

sleep 3

echo "Starting Dashboard..."
pnpm --filter @stratscope/dashboard dev &
DASHBOARD_PID=$!

echo ""
echo "=== Development Servers Started ==="
echo "API: http://localhost:8787"
echo "Dashboard: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop"

wait $API_PID $DASHBOARD_PID
