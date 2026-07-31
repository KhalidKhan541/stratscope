#!/bin/bash
set -e

echo "=== StratScope Dev Setup ==="

echo "Installing dependencies..."
pnpm install

echo "Creating local D1 database..."
wrangler d1 create stratscope-dev --local

echo "Running migrations..."
wrangler d1 migrations apply stratscope-dev --local

echo "=== Dev Setup Complete ==="
echo "Run: pnpm --filter @stratscope/api dev"
