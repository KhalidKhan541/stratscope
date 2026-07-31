#!/bin/bash
set -e

echo "=== StratScope Deployment Check ==="

errors=0

echo "Checking wrangler configuration..."
if [ -f "apps/api/wrangler.toml" ]; then
    echo "✓ wrangler.toml exists"
else
    echo "❌ wrangler.toml missing"
    errors=$((errors + 1))
fi

echo "Checking migrations..."
MIGRATION_COUNT=$(ls -1 apps/api/migrations/*.sql 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -gt 0 ]; then
    echo "✓ $MIGRATION_COUNT migrations found"
else
    echo "❌ No migrations found"
    errors=$((errors + 1))
fi

echo "Checking secrets..."
if wrangler secret list --env production 2>/dev/null | grep -q "CLERK_SECRET_KEY"; then
    echo "✓ CLERK_SECRET_KEY is set"
else
    echo "⚠ CLERK_SECRET_KEY not set (run: scripts/setup-secrets.sh)"
fi

if wrangler secret list --env production 2>/dev/null | grep -q "GROQ_API_KEY"; then
    echo "✓ GROQ_API_KEY is set"
else
    echo "⚠ GROQ_API_KEY not set"
fi

echo "Checking D1 database..."
if wrangler d1 list 2>/dev/null | grep -q "stratscope"; then
    echo "✓ D1 database exists"
else
    echo "⚠ D1 database not found (run: scripts/deploy.sh)"
fi

echo ""
echo "=== Deployment Check Complete ==="

if [ $errors -eq 0 ]; then
    echo "✓ All checks passed"
    exit 0
else
    echo "❌ $errors errors found"
    exit 1
fi
