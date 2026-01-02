# HOFOR Scraper - Home Assistant Addon

A TypeScript Home Assistant addon that scrapes HOFOR (Hovedstadens Forsyningsselskab) water consumption data and stores it in InfluxDB.

## Features

- Direct login to HOFOR (no MitID required)
- Water consumption tracking in m³
- InfluxDB time-series storage
- Historical data backfilling (up to 2 years)
- Configurable scraping interval (default: 3 hours)
- Exponential backoff retry logic
- Docker-optimized with Playwright Chromium

## Installation

### Home Assistant Addon Repository (Recommended)

1. **Add this repository to Home Assistant:**
   - Navigate to **Supervisor** → **Add-on Store** → **⋮** (menu) → **Repositories**
   - Add: `https://github.com/Jensen95/homeassistant-hofos`

2. **Install the addon:**
   - Find "HOFOR Scraper" in the addon store
   - Click **Install**

3. **Configure the addon** (see Configuration section below)

4. **Click Start**

## Configuration

### Required Settings

**HOFOR Credentials:**

- `hofor_kundenummer`: Your 7-digit HOFOR customer number
- `hofor_bs_kundenummer`: Your 8-digit HOFOR BS customer number

**InfluxDB Connection:**

- `influxdb_token`: Authentication token for your InfluxDB instance
  - Get this from the InfluxDB add-on UI under **Data** → **Tokens**

### Optional Settings

**InfluxDB Configuration:**

- `influxdb_url`: InfluxDB server URL (default: `http://a0d7b954-influxdb:8086`)
- `influxdb_org`: Organization name (default: `homeassistant`)
- `influxdb_bucket`: Bucket name (default: `homeassistant/autogen`)

**Water Price Tracking:**

- `water_price_per_m3`: Price per cubic meter (set to 0 to disable)
- `water_price_currency`: Currency code (default: `DKK`)

**Backfilling:**

- `enable_backfill`: Load historical data on first run (default: `true`)
- `backfill_days`: Number of days to backfill (1-730, default: 365)

**Scraping:**

- `scrape_interval_hours`: Hours between scrapes (1-24, default: 3)
- `log_level`: Logging verbosity (debug/info/warn/error, default: info)

### Example Configuration

```yaml
hofor_kundenummer: "7123456"
hofor_bs_kundenummer: "81234567"
influxdb_url: "http://a0d7b954-influxdb:8086"
influxdb_token: "your-influxdb-token-here"
influxdb_org: "homeassistant"
influxdb_bucket: "homeassistant/autogen"
water_price_per_m3: 28.50
water_price_currency: "DKK"
scrape_interval_hours: 3
enable_backfill: true
backfill_days: 365
log_level: "info"
```

## Data Structure

The addon writes two measurements to InfluxDB:

### water_consumption

- **Field:** `value` (float) - Daily consumption in m³
- **Tags:**
  - `unit`: Always "m³"
  - `source`: "hofor-scraper"
  - `backfilled`: "true" (only for historical data)
- **Timestamp:** Reading date from HOFOR

### water_price (optional)

- **Field:** `price_per_m3` (float) - Price per cubic meter
- **Tags:**
  - `currency`: Configured currency (e.g., "DKK")
  - `source`: "hofor-scraper"
- **Timestamp:** Current time

## Development

### Prerequisites

- Node.js 24+
- npm 10+

### Local Setup

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Run in development mode
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Run in development mode with hot reload |
| `npm start` | Run the compiled application |
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate test coverage report |
| `npm run lint` | Lint TypeScript code |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Type-check without emitting |

### Building Docker Image

```bash
docker build -t hofor-scraper .

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

## Querying Data

Example Flux query to get daily consumption:

```flux
from(bucket: "homeassistant/autogen")
  |> range(start: -30d)
  |> filter(fn: (r) => r["_measurement"] == "water_consumption")
  |> filter(fn: (r) => r["_field"] == "value")
```

## Troubleshooting

### Addon won't start

1. Check logs for error messages
2. Verify HOFOR credentials are correct
3. Ensure InfluxDB is running and accessible
4. Test InfluxDB token has read/write permissions

### No data appearing in InfluxDB

1. Check add-on logs for scraping errors
2. Verify you have consumption data on HOFOR's website
3. Check if backfilling completed (look for log message)
4. Ensure InfluxDB bucket name matches configuration

### Authentication failed

- Double-check your kundenummer and bs-kundenummer
- Verify you can log in at https://prod.tastselvservice.dk manually
- HOFOR may be down or undergoing maintenance

## License

MIT License - See LICENSE file for details
