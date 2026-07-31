#!/bin/bash
# Database migration script for StratScope
# Usage: ./scripts/db-migrate.sh [environment]

set -euo pipefail

ENVIRONMENT="${1:-development}"

echo "Running migrations for environment: $ENVIRONMENT"

if [ "$ENVIRONMENT" = "production" ]; then
  echo "Applying production migrations..."
  cd apps/api && npx wrangler d1 migrations apply stratscope --remote
elif [ "$ENVIRONMENT" = "staging" ]; then
  echo "Applying staging migrations..."
  cd apps/api && npx wrangler d1 migrations apply stratscope --remote --env staging
else
  echo "Applying local migrations..."
  cd apps/api && npx wrangler d1 migrations apply stratscope --local
fi

echo "Migrations complete."
