# HOFOR Scraper - Home Assistant Addon

A standalone Home Assistant addon that scrapes HOFOR (Hovedstadens Forsyningsselskab) water consumption data and pricing information, supporting both MQTT (for Home Assistant integration) and InfluxDB (for time-series data storage).

## Features

- 🔐 **Direct Login**: Uses HOFOR's standard login (no MitID required)
- 📊 **Dual Data Points**: Tracks consumption (m³) and price (DKK/m³)
- 🏠 **Home Assistant Integration**: Optional MQTT with automatic discovery for seamless setup
- 💾 **InfluxDB Support**: Optional time-series database storage for historical data
- 📈 **Historical Backfilling**: Automatically backfills up to 2 years of historical data
- 🔄 **Scheduled Scraping**: Configurable interval (default: every 3 hours)
- 🛡️ **Robust Error Handling**: Exponential backoff retry logic with configurable retries
- 🐳 **Docker Optimized**: Multi-stage Alpine build with Playwright Chromium
- 📝 **TypeScript**: Full type safety and modern async/await patterns

## Architecture

```
┌─────────────────┐    MQTT     ┌──────────────────┐
│ TypeScript Addon│ ──────────→ │ Home Assistant   │
│ (Playwright)    │             │ (MQTT Sensor)    │
└─────────────────┘             └──────────────────┘
        │
        │ InfluxDB Line Protocol
        ▼
┌─────────────────┐
│   InfluxDB      │
│ (Time Series DB)│
└─────────────────┘
        │
        ▼
┌─────────────────┐
│   HOFOR Min Side│
└─────────────────┘
```

## Installation

### Prerequisites

- HOFOR account credentials
- **Either**:
  - Home Assistant with Mosquitto MQTT broker addon installed (for MQTT integration)
  - InfluxDB instance (for time-series data storage)
  - Both (for dual storage)

### Manual Installation (Standalone)

1. Clone this repository into your Home Assistant addons directory:

```bash
cd /addons
git clone https://github.com/yourusername/homeassistant-hofos.git hofor-scraper
```

2. Refresh the Home Assistant Supervisor addon list
3. Install the "HOFOR Scraper" addon
4. Configure the addon (see Configuration section)
5. Start the addon

## Configuration

### Addon Options

Configure these options in the Home Assistant addon configuration page:

#### MQTT Configuration (Optional)
```yaml
hofor_kundenummer: "7xxxxxxx"
hofor_bs_kundenummer: "8xxxxxxx"
mqtt_broker: "mqtt://core-mosquitto:1883"
mqtt_username: ""  # Optional
mqtt_password: ""  # Optional
scrape_interval_hours: 3
log_level: "info"
```

#### InfluxDB Configuration (Optional)
```yaml
hofor_kundenummer: "7xxxxxxx"
hofor_bs_kundenummer: "8xxxxxxx"
influxdb_url: "http://localhost:8086"
influxdb_token: "your_influxdb_token"
influxdb_org: "your_org"
influxdb_bucket: "hofor"
enable_backfill: true
backfill_days: 365
scrape_interval_hours: 3
log_level: "info"
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `hofor_kundenummer` | Yes | - | Your HOFOR kundenummer |
| `hofor_bs_kundenummer` | Yes | - | Your HOFOR bs-kundenummer |
| `mqtt_broker` | No* | - | MQTT broker URL |
| `mqtt_username` | No | - | MQTT username (if authentication enabled) |
| `mqtt_password` | No | - | MQTT password (if authentication enabled) |
| `influxdb_url` | No* | - | InfluxDB server URL |
| `influxdb_token` | No* | - | InfluxDB authentication token |
| `influxdb_org` | No* | - | InfluxDB organization name |
| `influxdb_bucket` | No | `hofor` | InfluxDB bucket name |
| `enable_backfill` | No | `true` | Enable historical data backfilling |
| `backfill_days` | No | `365` | Number of days to backfill (1-730) |
| `scrape_interval_hours` | Yes | `3` | Hours between scraping attempts (1-24) |
| `log_level` | Yes | `info` | Logging level: debug, info, warn, error |

\* Either MQTT or InfluxDB configuration is required. Both can be configured for dual storage.

### Local Development

For local development without Docker:

1. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Install Playwright browsers:

```bash
npx playwright install chromium
```

4. Build the project:

```bash
npm run build
```

5. Run in development mode:

```bash
npm run dev
```

## InfluxDB Integration

When InfluxDB is configured, the addon stores data in two measurements:

### Water Consumption Measurement

- **Measurement**: `water_consumption`
- **Fields**:
  - `value` (float): Consumption in m³
- **Tags**:
  - `unit`: m³
  - `source`: hofor-scraper
  - `backfilled`: true/false (indicates if data was backfilled)
- **Timestamp**: Date of the consumption reading

### Water Price Measurement

- **Measurement**: `water_price`
- **Fields**:
  - `price_per_m3` (float): Price per m³
- **Tags**:
  - `currency`: DKK
  - `source`: hofor-scraper
- **Timestamp**: Date when price was retrieved

### Backfilling

When `enable_backfill: true` is set, the addon will:
1. Fetch historical data for the specified number of days (default: 365)
2. Insert all historical consumption data into InfluxDB
3. Tag backfilled data with `backfilled: true`
4. Handle duplicate data points automatically (InfluxDB overwrites existing points)

### Querying Data

Example Flux query to get daily consumption:

```flux
from(bucket: "hofor")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "water_consumption")
  |> filter(fn: (r) => r._field == "value")
```

## Home Assistant Sensors (MQTT Mode)

When MQTT is configured, the addon will create two sensors in Home Assistant:

### Water Consumption Sensor

- **Entity ID**: `sensor.hofor_consumption`
- **Unit**: m³
- **Device Class**: water
- **State Class**: total_increasing

### Price Sensor

- **Entity ID**: `sensor.hofor_price_per_m3`
- **Unit**: DKK/m³
- **Icon**: mdi:currency-usd

### Example Usage

Create a template sensor in Home Assistant to calculate daily cost:

```yaml
template:
  - sensor:
      - name: "HOFOR Daily Cost"
        unit_of_measurement: "DKK"
        state: >
          {% set consumption = states('sensor.hofor_consumption') | float %}
          {% set price = states('sensor.hofor_price_per_m3') | float %}
          {{ (consumption * price) | round(2) }}
```

## Development

### Project Structure

```
hofor-addon/
├── package.json          # Node.js dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vitest.config.ts      # Vitest testing configuration
├── Dockerfile            # Multi-stage Docker build
├── config.yaml           # Home Assistant addon metadata
├── .env.example          # Environment variables template
├── src/
│   ├── types.ts          # TypeScript interfaces
│   ├── scraper.ts        # Playwright scraping logic (existing scraper)
│   ├── playwright.ts     # Enhanced Playwright scraper with retry logic
│   ├── mqtt.ts           # MQTT client with auto-discovery
│   ├── influxdb.ts       # InfluxDB client for time-series storage
│   └── main.ts           # Main application orchestration
└── tests/
    ├── scraper.test.ts   # Scraper unit tests
    ├── mqtt.test.ts      # MQTT client unit tests
    └── influxdb.test.ts  # InfluxDB client unit tests
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

Run the container with MQTT:

```bash
docker run -d \
  --name hofor-scraper \
  -e HOFOR_KUNDENUMMER=7xxxxxxx \
  -e HOFOR_BS_KUNDENUMMER=8xxxxxxx \
  -e MQTT_BROKER=mqtt://localhost:1883 \
  hofor-scraper
```

Run the container with InfluxDB:

```bash
docker run -d \
  --name hofor-scraper \
  -e HOFOR_KUNDENUMMER=7xxxxxxx \
  -e HOFOR_BS_KUNDENUMMER=8xxxxxxx \
  -e INFLUXDB_URL=http://localhost:8086 \
  -e INFLUXDB_TOKEN=your_token \
  -e INFLUXDB_ORG=your_org \
  -e INFLUXDB_BUCKET=hofor \
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

### MQTT Connection Issues

If sensors don't appear in Home Assistant:

1. Verify Mosquitto addon is running
2. Check MQTT broker URL is correct
3. Enable MQTT logging in Home Assistant
4. Verify MQTT credentials if authentication is enabled

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

## Data Storage Comparison

| Feature | MQTT | InfluxDB |
|---------|------|----------|
| Real-time updates | ✓ | ✓ |
| Historical storage | Limited | ✓ |
| Backfilling support | ✗ | ✓ |
| Home Assistant integration | ✓ (native) | ✓ (via integration) |
| Query capabilities | Limited | Advanced (Flux) |
| Data retention | Depends on HA | Configurable |
| Resource usage | Low | Medium |

## TODO

- [x] Add retry logic with exponential backoff
- [x] Implement InfluxDB integration
- [x] Add historical data backfilling
- [x] Expose water price sensor
- [ ] Update DOM selectors based on actual HOFOR page structure
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
- Uses [MQTT.js](https://github.com/mqttjs/MQTT.js) for MQTT communication
- Uses [InfluxDB Client](https://github.com/influxdata/influxdb-client-js) for time-series data storage
- Logging powered by [Winston](https://github.com/winstonjs/winston)
- Testing with [Vitest](https://vitest.dev/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
