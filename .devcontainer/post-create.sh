#!/bin/bash
set -e

echo "🚀 Setting up HOFOR Home Assistant development environment..."

# Install Python dependencies globally (so Turborepo can find them)
echo "🐍 Installing Python dependencies..."
pip install --upgrade pip
pip install -r apps/hacs-integration/requirements-dev.txt

# Install root dependencies (Turborepo + workspaces)
echo "📦 Installing Node dependencies..."
npm install

# Install Playwright browsers for scraper
echo "🎭 Installing Playwright browsers..."
cd apps/scraper
npx playwright install chromium
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
echo "Turborepo commands (run from root):"
echo "  npm run build       # Build all apps"
echo "  npm run test        # Test all apps"
echo "  npm run lint        # Lint all apps"
echo "  npm run typecheck   # Type check all apps"
echo ""
echo "Filter to specific app:"
echo "  npm run test -- --filter=@hofor/scraper"
echo "  npm run test -- --filter=@hofor/hacs-integration"
echo ""
