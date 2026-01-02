# HOFOR Home Assistant Monorepo

A Turborepo monorepo for HOFOR (Hovedstadens Forsyningsselskab) water consumption tracking in Home Assistant.

## Overview

This repository contains two applications that work together to track water consumption from HOFOR:

| Application | Language | Description |
|-------------|----------|-------------|
| **[Scraper Addon](./apps/scraper)** | TypeScript | Home Assistant addon that scrapes HOFOR water data and stores it in InfluxDB |
| **[HACS Integration](./apps/hacs-integration)** | Python | Home Assistant integration that reads from InfluxDB and creates sensors for the Energy Dashboard |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     HOFOR Home Assistant                     │
│                         Monorepo                             │
└──────────────┬─────────────────────────┬────────────────────┘
               │                         │
       ┌───────▼────────┐        ┌──────▼─────────┐
       │ Scraper Addon  │        │ HACS Integration│
       │  (TypeScript)  │        │    (Python)     │
       │                │        │                 │
       │ - Playwright   │        │ - Config Flow   │
       │ - CSV parsing  │        │ - Coordinator   │
       │ - InfluxDB     │        │ - Statistics    │
       │   writes       │        │   import        │
       └────────┬───────┘        └───────┬─────────┘
                │                        │
                │   ┌───────────────┐    │
                └──►│   InfluxDB    │◄───┘
                    │  (Time Series) │
                    └───────┬───────┘
                            │
                    ┌───────▼────────┐
                    │ Home Assistant │
                    │Energy Dashboard│
                    └────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 24+
- npm 10+

### Installation

```bash
# Install dependencies
npm install

# Build all apps
npm run build

# Run tests
npm run test
```

### Development

```bash
# Run development mode
npm run dev

# Run linting
npm run lint

# Format code
npm run format
```

## Workspaces

This monorepo uses npm workspaces with Turborepo for task orchestration.

### Apps

- `apps/scraper` - TypeScript Home Assistant addon
- `apps/hacs-integration` - Python HACS integration

### Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Build all applications |
| `npm run test` | Run all tests |
| `npm run lint` | Lint all applications |
| `npm run format` | Format all code |
| `npm run dev` | Start development mode |
| `npm run clean` | Clean all build artifacts |

## How It Works

### 1. Scraper Addon (Data Collection)

The scraper addon runs as a Home Assistant addon container:

- Logs into HOFOR website using your credentials
- Downloads consumption CSV data using Playwright
- Parses Danish date/number formats
- Writes data to InfluxDB with proper timestamps
- Runs on configurable schedule (default: every 3 hours)
- Supports historical backfilling (up to 2 years)

### 2. HACS Integration (Home Assistant Sensors)

The HACS integration runs inside Home Assistant:

- Reads water consumption data from InfluxDB
- Creates a sensor with `state_class: total_increasing`
- Imports historical statistics using `async_import_statistics`
- Enables Energy Dashboard water tracking
- Configurable via UI flow

## Installation in Home Assistant

### Scraper Addon

1. Add repository to Home Assistant Add-on Store:
   ```
   https://github.com/Jensen95/homeassistant-hofos
   ```
2. Install "HOFOR Scraper" addon
3. Configure with your HOFOR credentials and InfluxDB settings
4. Start the addon

### HACS Integration

1. Add as custom repository in HACS
2. Install "HOFOR Water" integration
3. Configure InfluxDB connection via UI
4. Add sensor to Energy Dashboard

## Development Setup

### Devcontainer (Recommended)

This repository includes a devcontainer configuration with:

- Python 3.12 + Node.js 24
- Home Assistant Core for testing
- InfluxDB 2.7 for data storage
- Pre-configured VS Code extensions

```bash
# Open in VS Code with Dev Containers extension
code .
# Then: Ctrl+Shift+P -> "Dev Containers: Reopen in Container"
```

### Local Development

```bash
# Scraper addon
cd apps/scraper
npm install
npm run dev

# HACS integration (requires Python 3.12+)
cd apps/hacs-integration
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements-dev.txt
pytest
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details
