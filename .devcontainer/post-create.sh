#!/bin/bash
set -e

echo "🚀 Setting up HOFOR Home Assistant development environment..."

# Install root dependencies (Turborepo)
echo "📦 Installing root dependencies..."
npm install

# Install scraper dependencies
echo "📦 Installing scraper dependencies..."
cd apps/scraper
npm install
npx playwright install chromium
cd ../..

# Set up Python virtual environment for HACS integration
echo "🐍 Setting up Python environment..."
cd apps/hacs-integration
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements-dev.txt
deactivate
cd ../..

# Wait for InfluxDB to be ready
echo "⏳ Waiting for InfluxDB to be ready..."
until curl -s http://localhost:8086/health > /dev/null 2>&1; do
    sleep 2
done
echo "✅ InfluxDB is ready"

# Wait for Home Assistant to be ready
echo "⏳ Waiting for Home Assistant to be ready..."
until curl -s http://localhost:8123 > /dev/null 2>&1; do
    sleep 2
done
echo "✅ Home Assistant is ready"

echo ""
echo "🎉 Development environment is ready!"
echo ""
echo "Available services:"
echo "  - Home Assistant: http://localhost:8123"
echo "  - InfluxDB:       http://localhost:8086"
echo ""
echo "InfluxDB credentials:"
echo "  - Username: admin"
echo "  - Password: adminpassword"
echo "  - Token:    dev-token-for-testing"
echo "  - Org:      homeassistant"
echo "  - Bucket:   homeassistant/autogen"
echo ""
echo "Quick commands:"
echo "  - npm run build       # Build all apps"
echo "  - npm run test        # Run all tests"
echo "  - cd apps/scraper && npm run dev    # Run scraper in dev mode"
echo "  - cd apps/hacs-integration && source .venv/bin/activate && pytest  # Run HACS tests"
echo ""
