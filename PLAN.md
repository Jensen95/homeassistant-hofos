# Monorepo Conversion Implementation Plan

**Goal**: Convert HOFOR scraper to Turborepo monorepo with scraper addon and HACS integration

---

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Turborepo Foundation | Complete |
| Phase 2 | Move Scraper to apps/scraper | Complete |
| Phase 3 | Create HACS Integration Structure | Complete |
| Phase 4 | HACS Testing Infrastructure (TDD) | Complete |
| Phase 5 | Devcontainer Setup | Complete |
| Phase 6 | CI/CD Pipelines | Complete |

---

## Phase 1: Turborepo Foundation

- [x] Create PLAN.md tracking document
- [x] Create turbo.json with task definitions
- [x] Create root package.json with workspaces
- [x] Update .gitignore for Turborepo
- [x] Create root README.md

## Phase 2: Move Scraper to apps/scraper

- [x] Create apps/scraper directory
- [x] Move source files to apps/scraper/src/
- [x] Move config files (config.yaml, Dockerfile, run.sh)
- [x] Move build configs (tsconfig.json, vitest.config.ts, eslint.config.mjs)
- [x] Move release config (.releaserc.json)
- [x] Create apps/scraper/package.json
- [x] Move DOCS.md to apps/scraper/README.md

## Phase 3: Create HACS Integration Structure

- [x] Create apps/hacs-integration directory structure
- [x] Create custom_components/hofor_water/
- [x] Create manifest.json
- [x] Create const.py (constants)
- [x] Create strings.json (UI translations)
- [x] Create __init__.py (component setup)
- [x] Create config_flow.py (InfluxDB connection UI)
- [x] Create sensor.py (water consumption sensor with state_class: total_increasing)
- [x] Create coordinator.py (InfluxDB query + statistics import + backfill)
- [x] Create requirements.txt (influxdb-client==1.45.0)
- [x] Create requirements-dev.txt (pytest, pytest-homeassistant-custom-component, etc.)
- [x] Create pyproject.toml (ruff, mypy config)
- [x] Create hacs.json metadata
- [x] Create README.md (installation, development, TDD workflow)

## Phase 4: HACS Testing Infrastructure (TDD)

- [x] Create apps/hacs-integration/tests/ directory
- [x] Create tests/conftest.py (pytest fixtures)
- [x] Create tests/test_config_flow.py (InfluxDB validation, user input, error handling)
- [x] Create tests/test_sensor.py (sensor creation, attributes, value updates)
- [x] Create tests/test_coordinator.py (InfluxDB queries, statistics import, backfill)
- [x] Mock InfluxDB HTTP responses for unit tests

## Phase 5: Devcontainer Setup

- [x] Create .devcontainer directory
- [x] Create .devcontainer/devcontainer.json (Python 3.12 + Node.js 24)
- [x] VS Code extensions configured
- [x] Create .devcontainer/docker-compose.yml
- [x] Home Assistant service (latest stable, port 8123)
- [x] InfluxDB service (2.7, port 8086)
- [x] Volume mounts and postCreateCommand configured

## Phase 6: CI/CD Pipelines

- [x] Update .github/workflows/ci.yml (Turborepo with caching, both apps)
- [x] Create .github/workflows/release-scraper.yml (semantic-release + Docker)
- [x] Create .github/workflows/release-hacs.yml (semantic-release + zip packaging)
- [x] Update .github/dependabot.yml for monorepo structure

---

## Architecture Overview

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

---

## Directory Structure (Final)

```
homeassistant-hofos/
├── apps/
│   ├── scraper/                    # TypeScript Home Assistant addon
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── types.ts
│   │   │   ├── fetchHoforData.ts
│   │   │   ├── fetchHoforData.test.ts
│   │   │   ├── influxdb.ts
│   │   │   ├── influxdb.test.ts
│   │   │   └── influxdb.types.ts
│   │   ├── scripts/
│   │   │   └── sync-version.ts
│   │   ├── config.yaml             # HA addon manifest
│   │   ├── Dockerfile
│   │   ├── run.sh
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── eslint.config.mjs
│   │   ├── .releaserc.json
│   │   └── README.md
│   │
│   └── hacs-integration/           # Python HACS integration
│       ├── custom_components/
│       │   └── hofor_water/
│       │       ├── __init__.py
│       │       ├── manifest.json
│       │       ├── const.py
│       │       ├── config_flow.py
│       │       ├── sensor.py
│       │       ├── coordinator.py
│       │       └── strings.json
│       ├── scripts/
│       │   └── update_version.py
│       ├── tests/
│       │   ├── __init__.py
│       │   ├── conftest.py
│       │   ├── test_config_flow.py
│       │   ├── test_sensor.py
│       │   └── test_coordinator.py
│       ├── requirements.txt
│       ├── requirements-dev.txt
│       ├── pyproject.toml
│       ├── hacs.json
│       ├── .releaserc.json
│       └── README.md
│
├── .devcontainer/
│   ├── devcontainer.json
│   ├── docker-compose.yml
│   └── post-create.sh
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── release-scraper.yml
│   │   └── release-hacs.yml
│   └── dependabot.yml
│
├── turbo.json
├── package.json                    # Root workspace config
├── README.md
├── PLAN.md
├── CHANGELOG.md
├── repository.yaml
└── .gitignore
```

---

## Technical Notes

### Scraper (TypeScript addon)
- Runs in own Docker container via Home Assistant supervisor
- No Python dependencies
- Uses Playwright for web scraping
- Writes to InfluxDB
- Semantic-release with Docker image publishing

### HACS Integration (Python)
- Runs inside Home Assistant's Python environment
- Reads from InfluxDB
- Creates sensor with state_class: total_increasing
- Imports statistics with historical timestamps via async_import_statistics
- User-configurable polling interval (default: 3 hours)
- Semantic-release with zip packaging

---

## Future Considerations
- [ ] InfluxDB seed data script for devcontainer testing
- [ ] Shared Python utilities package (only if needed later)
- [ ] HACS integration: cost sensor entity
