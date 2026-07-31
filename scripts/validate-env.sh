#!/bin/bash
set -e

echo "=== StratScope Environment Validation ==="

errors=0

echo "Checking required tools..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    errors=$((errors + 1))
else
    echo "✓ Node.js $(node --version)"
fi

if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm not found"
    errors=$((errors + 1))
else
    echo "✓ pnpm $(pnpm --version)"
fi

if ! command -v wrangler &> /dev/null; then
    echo "⚠ wrangler not found (optional for local dev)"
else
    echo "✓ wrangler $(wrangler --version)"
fi

echo ""
echo "Checking environment files..."

if [ -f ".env.development" ]; then
    echo "✓ .env.development exists"
else
    echo "❌ .env.development missing"
    errors=$((errors + 1))
fi

if [ -f ".env.example" ]; then
    echo "✓ .env.example exists"
else
    echo "❌ .env.example missing"
    errors=$((errors + 1))
fi

echo ""
echo "Checking dependencies..."

if [ -d "node_modules" ]; then
    echo "✓ Root dependencies installed"
else
    echo "⚠ Root dependencies not installed (run: pnpm install)"
fi

if [ -d "apps/api/node_modules" ]; then
    echo "✓ API dependencies installed"
else
    echo "⚠ API dependencies not installed"
fi

if [ -d "apps/dashboard/node_modules" ]; then
    echo "✓ Dashboard dependencies installed"
else
    echo "⚠ Dashboard dependencies not installed"
fi

echo ""
echo "=== Validation Complete ==="

if [ $errors -eq 0 ]; then
    echo "✓ All checks passed"
    exit 0
else
    echo "❌ $errors errors found"
    exit 1
fi
