#!/bin/bash
set -e

echo "=== StratScope Deployment ==="

if ! command -v wrangler &> /dev/null; then
    echo "Installing wrangler..."
    npm install -g wrangler
fi

echo "Logging in to Cloudflare..."
wrangler login

echo "Creating D1 database..."
wrangler d1 create stratscope-prod --json > /tmp/d1-output.json
D1_ID=$(cat /tmp/d1-output.json | grep -o '"database_id": "[^"]*"' | cut -d'"' -f4)
echo "D1 Database ID: $D1_ID"

echo "Creating KV namespace..."
wrangler kv namespace create KV --json > /tmp/kv-output.json
KV_ID=$(cat /tmp/kv-output.json | grep -o '"id": "[^"]*"' | cut -d'"' -f4)
echo "KV Namespace ID: $KV_ID"

echo "Creating R2 bucket..."
wrangler r2 bucket create stratscope-prod-r2 || echo "Bucket may already exist"

echo "Creating Queue..."
wrangler queue create stratscope-prod-queue || echo "Queue may already exist"

echo "Running D1 migrations..."
wrangler d1 migrations apply stratscope-prod --env production

echo "Setting secrets..."
echo "Please set the following secrets:"
echo "  wrangler secret put CLERK_SECRET_KEY --env production"
echo "  wrangler secret put CLERK_PUBLISHABLE_KEY --env production"
echo "  wrangler secret put GROQ_API_KEY --env production"
echo "  wrangler secret put STRIPE_SECRET_KEY --env production"

echo "Deploying API..."
wrangler deploy --env production

echo "=== Deployment Complete ==="
echo "API URL: https://stratscope-api.your-subdomain.workers.dev"
