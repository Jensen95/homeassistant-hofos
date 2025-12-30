# HOFOR Scraper - Home Assistant Addon

A standalone Home Assistant addon that scrapes HOFOR (Hovedstadens Forsyningsselskab) water consumption data and stores it in InfluxDB for time-series data storage and analysis.

## Features

- 🔐 **Direct Login**: Uses HOFOR's standard login (no MitID required)
- 📊 **Water Consumption Tracking**: Tracks daily consumption in m³
- 💾 **InfluxDB Storage**: Time-series database storage for historical data
- 📈 **Historical Backfilling**: Automatically backfills up to 2 years of historical data
- 🔄 **Scheduled Scraping**: Configurable interval (default: every 3 hours)
- 🛡️ **Robust Error Handling**: Exponential backoff retry logic (3 attempts with increasing delays)
- 🐳 **Docker Optimized**: Multi-stage Alpine build with Playwright Chromium
- 📝 **TypeScript**: Full type safety with colocated types and modern async/await patterns

## Architecture

```sh
┌─────────────────────┐
│ TypeScript Addon    │
│ (Playwright)        │
│  - Fetches CSV data │
│  - Parses DD.MM.YYYY│
│  - Handles Danish   │
│    decimal format   │
└──────────┬──────────┘
           │
           │ InfluxDB Line Protocol
           ▼
┌─────────────────────┐
│   InfluxDB          │
│ (Time Series DB)    │
│  - water_consumption│
│  - Tagged data      │
└──────────┬──────────┘
           │
           │ HTTPS
           ▼
┌─────────────────────┐
│   HOFOR Min Side    │
│ prod.tastselvservice│
└─────────────────────┘
```

## Installation

### Prerequisites

- HOFOR account credentials (kundenummer and bs-kundenummer)
- InfluxDB instance (Home Assistant InfluxDB addon recommended)
- Home Assistant Supervisor (for addon installation)

### Manual Installation (Standalone)

1. Clone this repository into your Home Assistant addons directory:

```bash
cd /addons
git clone https://github.com/yourusername/homeassistant-hofos.git hofor-scraper
```

1. Refresh the Home Assistant Supervisor addon list
2. Install the "HOFOR Scraper" addon
3. Configure the addon (see Configuration section)
4. Start the addon

## Configuration

### Addon Options

Configure these options in the Home Assistant addon configuration page:

```yaml
hofor_kundenummer: "7xxxxxxx"
hofor_bs_kundenummer: "8xxxxxxx"
influxdb_url: "http://a0d7b954-influxdb:8086"  # Home Assistant InfluxDB addon default
influxdb_token: "your_influxdb_token"
influxdb_org: "homeassistant"
influxdb_bucket: "homeassistant/autogen"
enable_backfill: true
backfill_days: 365
scrape_interval_hours: 3
log_level: "info"
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `hofor_kundenummer` | Yes | - | Your HOFOR kundenummer (7-digit) |
| `hofor_bs_kundenummer` | Yes | - | Your HOFOR bs-kundenummer (8-digit) |
| `influxdb_url` | No | `http://a0d7b954-influxdb:8086` | InfluxDB server URL (HA addon default) |
| `influxdb_token` | Yes | - | InfluxDB authentication token |
| `influxdb_org` | No | `homeassistant` | InfluxDB organization name |
| `influxdb_bucket` | No | `homeassistant/autogen` | InfluxDB bucket name |
| `enable_backfill` | No | `true` | Enable historical data backfilling |
| `backfill_days` | No | `365` | Number of days to backfill (1-730) |
| `scrape_interval_hours` | No | `3` | Hours between scraping attempts (1-24) |
| `log_level` | No | `info` | Logging level: debug, info, warn, error |

### Local Development

For local development without Docker:

1. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

1. Install dependencies:

```bash
npm install
```

1. Install Playwright browsers:

```bash
npx playwright install chromium
```

1. Build the project:

```bash
npm run build
```

1. Run in development mode:

```bash
npm run dev
```

## InfluxDB Integration

The addon stores water consumption data in InfluxDB:

### Water Consumption Measurement

- **Measurement**: `water_consumption`
- **Fields**:
  - `value` (float): Consumption in m³
- **Tags**:
  - `unit`: m³
  - `source`: hofor-scraper
  - `backfilled`: true/false (indicates if data was backfilled)
- **Timestamp**: Date of the consumption reading (DD.MM.YYYY format from HOFOR)

### Data Format

- **Date Parsing**: Handles Danish date format (DD.MM.YYYY)
- **Decimal Parsing**: Supports Danish decimal format with comma (e.g., "10,5" → 10.5)
- **Validation**: Skips invalid dates and usage values automatically

### Backfilling

When `enable_backfill: true` is set, the addon will:

1. Fetch historical data for the specified number of days (default: 365)
2. Insert all historical consumption data into InfluxDB
3. Tag backfilled data with `backfilled: true`
4. Handle duplicate data points automatically (InfluxDB overwrites existing points)

### Querying Data

Example Flux query to get daily consumption:

```flux
from(bucket: "homeassistant/autogen")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "water_consumption")
  |> filter(fn: (r) => r._field == "value")
```

Example to get only fresh data (excluding backfilled):

```flux
from(bucket: "homeassistant/autogen")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "water_consumption")
  |> filter(fn: (r) => r._field == "value")
  |> filter(fn: (r) => r.backfilled != "true")
```

## Development

### Project Structure

```sh
hofor-addon/
├── package.json          # Node.js dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vitest.config.ts      # Vitest testing configuration
├── Dockerfile            # Multi-stage Docker build
├── config.yaml           # Home Assistant addon metadata
├── .env.example          # Environment variables template
├── src/
│   ├── types.ts          # Global TypeScript interfaces
│   ├── influxdb.types.ts # InfluxDB-specific type definitions
│   ├── influxdb.ts       # InfluxDB client for time-series storage
│   ├── influxdb.test.ts  # InfluxDB client unit tests (TDD approach)
│   ├── playwright.ts     # Enhanced Playwright scraper with retry logic
│   └── main.ts           # Main application orchestration
└── tests/
    └── influxdb.test.ts  # InfluxDB client unit tests
```

### Colocated Types

Types are colocated with their respective modules:

- **influxdb.types.ts**: InfluxDB-specific types (ConsumptionData, PriceData, HistoricalDataPoint, InfluxDBConfig)
- **types.ts**: Global application types (AddonConfig, HoforCredentials, ScraperResult, ScraperError)

### Testing Approach

The project uses **Test-Driven Development (TDD)** principles:

- Tests validate actual data parsing and transformations, not just log output
- Mock InfluxDB Point objects capture and verify field values, tags, and timestamps
- Tests cover edge cases: invalid dates, Danish decimal format, null handling

Example test structure:

```typescript
it('should parse Danish decimal format with comma', async () => {
  const historicalData = [{ date: '15.03.2024', usage: '25,75', metric: 'm³' }];
  await influxdbClient.writeHistoricalData(historicalData);
  
  const point = mockPoints[0];
  expect(point.getField('value')).toBe(25.75); // Verifies parsing, not logs
});
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run in development mode with hot reload
- `npm start` - Run the compiled application
- `npm test` - Run tests with Vitest
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:coverage` - Generate test coverage report
- `npm run lint` - Lint TypeScript code
- `npm run format` - Format code with Prettier

### Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

### Building Docker Image

Build the Docker image locally:

```bash
docker build -t hofor-scraper .
```

Run the container:

```bash
docker run -d \
  --name hofor-scraper \
  -e HOFOR_KUNDENUMMER=7xxxxxxx \
  -e HOFOR_BS_KUNDENUMMER=8xxxxxxx \
  -e INFLUXDB_URL=http://localhost:8086 \
  -e INFLUXDB_TOKEN=your_token \
  -e INFLUXDB_ORG=homeassistant \
  -e INFLUXDB_BUCKET=homeassistant/autogen \
  -e ENABLE_BACKFILL=true \
  -e BACKFILL_DAYS=365 \
  hofor-scraper
```

## Troubleshooting

### Scraping Fails

If scraping fails, check the addon logs:

1. Enable debug logging by setting `log_level: debug`
2. Check the addon logs for detailed error messages
3. Verify your HOFOR credentials are correct
4. Ensure HOFOR website structure hasn't changed

### InfluxDB Connection Issues

If data doesn't appear in InfluxDB:

1. Verify InfluxDB addon is running
2. Check InfluxDB URL is correct (default: `http://a0d7b954-influxdb:8086`)
3. Verify InfluxDB token has write permissions for the bucket
4. Check InfluxDB organization and bucket names match your configuration

### Browser Issues

If Playwright fails to launch:

1. Check Docker container has sufficient memory (minimum 512MB)
2. Verify Chromium is installed correctly in container
3. Try running with `HEADLESS=false` for debugging (requires X server)

## Important Notes

- **Data Frequency**: HOFOR typically updates consumption data once per day, and it may be 1-2 days delayed
- **Scraping Interval**: Default 3-hour interval is recommended to avoid unnecessary load on HOFOR's servers
- **Rate Limiting**: The addon includes exponential backoff retry logic (3 retries with increasing delays) to handle temporary failures
- **Selectors**: The DOM selectors may need adjustment if HOFOR changes their website structure
- **Duplicate Data**: InfluxDB automatically handles duplicate data points by overwriting them based on timestamp
- **Backfilling**: Historical data backfilling is performed once at startup when enabled. It can take a few minutes depending on the number of days configured

## TODO

- [x] Add retry logic with exponential backoff
- [x] Implement InfluxDB integration
- [x] Add historical data backfilling
- [x] Colocate types with their respective modules
- [x] Use TDD approach for tests (validate data parsing, not logs)
- [x] Update DOM selectors based on actual HOFOR page structure
- [ ] Add support for multi-architecture Docker builds (arm64, armv7)
- [ ] Create GitHub Actions CI/CD pipeline
- [ ] Add more comprehensive error notifications
- [ ] Add Grafana dashboard examples for InfluxDB data

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [Playwright](https://playwright.dev/) for reliable web scraping
- Uses [InfluxDB Client](https://github.com/influxdata/influxdb-client-js) for time-series data storage
- Logging powered by [Winston](https://github.com/winstonjs/winston)
- Testing with [Vitest](https://vitest.dev/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
