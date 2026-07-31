#!/bin/bash
# Start local D1 database studio
set -euo pipefail
echo "Starting D1 studio..."
cd apps/api && npx wrangler d1 execute stratscope --local --command "SELECT 1"
echo "D1 local database ready."
