#!/bin/bash
set -e

echo "=== StratScope Seed Data ==="

API_URL="${API_URL:-http://localhost:8787}"
TOKEN="${API_TOKEN:-dev-token}"

echo "Creating test project..."
curl -s -X POST "$API_URL/v1/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "description": "A test project for development"
  }' | jq .

echo "Creating test agent..."
curl -s -X POST "$API_URL/v1/agents" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test-project",
    "name": "Test Agent",
    "description": "A test agent",
    "framework": "custom"
  }' | jq .

echo "Creating sample execution..."
curl -s -X POST "$API_URL/v1/executions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "test-project",
    "agent_id": "test-agent",
    "input": "Hello, world!",
    "model": "llama-3.3-70b-versatile",
    "provider": "groq"
  }' | jq .

echo "=== Seed Data Complete ==="
