# HOFOR Scraper - AI Agent Instructions

## Project Overview
Home Assistant addon that scrapes HOFOR water consumption data using Playwright and stores it in InfluxDB. Built as a scheduled TypeScript service with browser automation.

## Architecture
- **Data Flow**: Playwright scraper → InfluxDB line protocol → Time-series storage
- **Main Components**:
  - [src/main.ts](../src/main.ts): Application lifecycle (startup, scheduling, shutdown, signal handling)
  - [src/playwright.ts](../src/playwright.ts): Headless Chromium automation for CSV data fetching
  - [src/influxdb.ts](../src/influxdb.ts): InfluxDB client with historical backfill support
  - [src/types.ts](../src/types.ts): TypeScript interfaces and custom error classes

## Critical Implementation Details

### Browser Automation Pattern
- Uses Playwright with system Chromium (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser`)
- Implementation in [playwright.ts](../src/playwright.ts) fetches CSV data via intercepted AJAX requests
- Login flow: Handle cookie consent → Fill credentials → Navigate → Intercept AJAX → Fetch CSV data
- CSV parsing: Filter out `#N/A` values and header rows with `CSV_HEADER_VALUE = 'Forbrug'`
- **Debugging**: Enable traces with `HEADLESS=false`, use `await page.context().tracing.start()` / `.stop()` for detailed traces

### Data Storage
- InfluxDB writes use `Point` API with default tag `source: 'hofor-scraper'`
- Two measurements: `water_consumption` (value, unit) and `water_price` (price_per_m3, currency)
- Historical backfill: Optional feature controlled by `ENABLE_BACKFILL` env var, writes points with `backfilled: 'true'` tag
- Timestamps: Use `readingDate` if available, fallback to `timestamp`

### Error Handling
- Custom `ScraperError` class with `code` and `retryable` boolean
- Exponential backoff retry logic in [playwright.ts](../src/playwright.ts): `RETRY_DELAY_MS * attempt` with `MAX_RETRIES = 3`
- Graceful shutdown on SIGINT/SIGTERM signals with cleanup of browser resources

## Development Workflow

### Testing
```bash
npm test                 # Run tests with Vitest
npm run test:ui          # Open Vitest UI
npm run test:coverage    # Generate coverage report
```
- Tests use Vitest with 30s timeout (see [vitest.config.ts](../vitest.config.ts))
- Test files: `*.test.ts` (excluded from TypeScript compilation)
- Coverage provider: v8
- **TDD Approach**: Write tests first, then implementation
- **Testing Guidelines**: Avoid asserting on log output unless the log itself is critical behavior

### Running Locally
```bash
npm run dev              # Watch mode with tsx
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled code
```

### Environment Configuration
Required variables in `.env`:
- `HOFOR_KUNDENUMMER` / `HOFOR_BS_KUNDENUMMER`: HOFOR credentials
- `INFLUXDB_TOKEN`: InfluxDB authentication
- Optional: `HEADLESS=false` for debugging browser automation, `ENABLE_BACKFILL=true`, `BACKFILL_DAYS=365`

### Docker/Home Assistant
- Multi-stage Alpine build: Builder stage (with Python/make/g++ for native deps) → Runtime stage (with system Chromium)
- Addon config in [config.yaml](../config.yaml): Maps env vars for Home Assistant integration
- Default InfluxDB URL: `http://a0d7b954-influxdb:8086` (Home Assistant addon format)
- **Deployment**: GitHub Actions workflow will handle automated builds and releases

## Code Conventions

### Commit Guidelines
- **Atomic commits**: Each commit should contain one logical change
- **Commitizen format**: Follow conventional commits specification
  - `feat:` New features
  - `fix:` Bug fixes
  - `docs:` Documentation changes
  - `refactor:` Code refactoring without behavior changes
  - `test:` Test additions or modifications
  - `chore:` Build process, tooling, dependencies
  - Example: `feat: add historical backfill support for InfluxDB`

### Module System
- **ES Modules**: All imports use `.js` extension (e.g., `import { foo } from './bar.js'`)
- `"type": "module"` in [package.json](../package.json)
- Target: ES2022 with Node.js 24+ ([tsconfig.json](../tsconfig.json))

### Logging
- Winston logger with JSON format and colorized console output
- Log levels: debug, info, warn, error
- Pattern: `this.logger.info('Message', { contextObject })`

### TypeScript Strictness
- All strict flags enabled: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- Use explicit return types for public methods
- Prefer interfaces over types (see [types.ts](../src/types.ts))

## Common Tasks

### Adding New Scraper Fields
1. Update interface in [types.ts](../src/types.ts) (e.g., `ConsumptionData`)
2. Extract data in [playwright.ts](../src/playwright.ts) CSV parsing logic
3. Add InfluxDB measurement/field in [influxdb.ts](../src/influxdb.ts)
4. Update tests in corresponding `*.test.ts` file

### Updating DOM Selectors
- For page changes, update Playwright role-based selectors in [playwright.ts](../src/playwright.ts) (e.g., `getByRole('button', { name: 'Log ind' })`)
- Use Playwright code generation for new selectors: `npx playwright codegen https://prod.tastselvservice.dk`

### Adjusting Scrape Schedule
- Modify `SCRAPE_INTERVAL_HOURS` env var or `scrape_interval_hours` in [config.yaml](../config.yaml)
- Default: 3 hours (interval set in milliseconds: `intervalMs = hours * 60 * 60 * 1000`)

## Key Dependencies
- `playwright@^1.57.0`: Browser automation (uses system Chromium in Docker)
- `@influxdata/influxdb-client@^1.35.0`: Time-series database client
- `winston@^3.19.0`: Structured logging
- `vitest@^4.0.16`: Testing framework with UI and coverage

## Gotchas
- **Date Parsing**: HOFOR CSV uses DD.MM.YYYY format - parsing logic in [influxdb.ts](../src/influxdb.ts) `parseDate()`
- **Decimal Separator**: Replace comma with period in `parseDecimalValue()` (Danish locale)
- **Browser Cleanup**: Always call `await scraper.close()` in shutdown to prevent resource leaks
- **Signal Handling**: App sets `isShuttingDown` flag to prevent new scrapes during graceful shutdown
