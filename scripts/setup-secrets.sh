#!/bin/bash
set -e

echo "=== StratScope Secrets Setup ==="

if ! command -v wrangler &> /dev/null; then
    echo "Error: wrangler not found. Install with: npm install -g wrangler"
    exit 1
fi

set_secret() {
    local name=$1
    local env=$2
    
    echo "Setting $name for $env..."
    read -s -p "Enter value for $name: " value
    echo
    
    if [ -n "$value" ]; then
        echo "$value" | wrangler secret put "$name" --env "$env"
        echo "✓ $name set"
    else
        echo "⚠ Skipping $name (empty value)"
    fi
}

echo ""
echo "--- Development Environment ---"
set_secret "CLERK_SECRET_KEY" "dev"
set_secret "CLERK_PUBLISHABLE_KEY" "dev"
set_secret "GROQ_API_KEY" "dev"
set_secret "STRIPE_SECRET_KEY" "dev"

echo ""
echo "--- Production Environment ---"
set_secret "CLERK_SECRET_KEY" "production"
set_secret "CLERK_PUBLISHABLE_KEY" "production"
set_secret "GROQ_API_KEY" "production"
set_secret "STRIPE_SECRET_KEY" "production"

echo ""
echo "=== Secrets Setup Complete ==="
