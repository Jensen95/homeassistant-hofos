# HOFOR Scraper - Home Assistant Addon

A standalone Home Assistant addon that scrapes HOFOR (Hovedstadens Forsyningsselskab) water consumption data and pricing information, publishing it via MQTT for integration with Home Assistant.

## Features

- 🔐 **Direct Login**: Uses HOFOR's standard login (no MitID required)
- 📊 **Dual Sensors**: Publishes separate consumption (m³) and price (DKK/m³) sensors
- 🏠 **Home Assistant Integration**: Automatic MQTT discovery for seamless setup
- 🔄 **Scheduled Scraping**: Configurable interval (default: every 3 hours)
- 🛡️ **Robust Error Handling**: Exponential backoff retry logic
- 🐳 **Docker Optimized**: Multi-stage Alpine build with Playwright Chromium
- 📝 **TypeScript**: Full type safety and modern async/await patterns

## Architecture

```
┌─────────────────┐    MQTT    ┌──────────────────┐
│ TypeScript Addon│ ─────────→ │ Home Assistant   │
│ (Playwright)    │            │ (MQTT Sensor)    │
└─────────────────┘            └──────────────────┘
        │
        ▼
┌─────────────────┐
│   HOFOR Min Side│
└─────────────────┘
```

## Installation

### Prerequisites

- Home Assistant with Mosquitto MQTT broker addon installed
- HOFOR account credentials

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

```yaml
hofor_kundenummer: "7xxxxxxx"
hofor_bs_kundenummer: "8xxxxxxx"
mqtt_broker: "mqtt://core-mosquitto:1883"
mqtt_username: ""  # Optional
mqtt_password: ""  # Optional
scrape_interval_hours: 3
log_level: "info"
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `hofor_kundenummer` | Yes | - | Your HOFOR kundenummer |
| `hofor_bs_kundenummer` | Yes | - | Your HOFOR bs-kundenummer |
| `mqtt_broker` | Yes | `mqtt://core-mosquitto:1883` | MQTT broker URL |
| `mqtt_username` | No | - | MQTT username (if authentication enabled) |
| `mqtt_password` | No | - | MQTT password (if authentication enabled) |
| `scrape_interval_hours` | Yes | `3` | Hours between scraping attempts (1-24) |
| `log_level` | Yes | `info` | Logging level: debug, info, warn, error |

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

## Home Assistant Sensors

Once configured, the addon will create two sensors in Home Assistant:

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
│   ├── scraper.ts        # Playwright scraping logic
│   ├── mqtt.ts           # MQTT client with auto-discovery
│   └── main.ts           # Main application orchestration
└── tests/
    ├── scraper.test.ts   # Scraper unit tests
    └── mqtt.test.ts      # MQTT client unit tests
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
  -e HOFOR_USERNAME=your_email@example.com \
  -e HOFOR_PASSWORD=your_password \
  -e MQTT_BROKER=mqtt://localhost:1883 \
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
- **Scraping Interval**: Default 3-hour interval is recommended to avoid unnecessary load
- **Rate Limiting**: The addon includes exponential backoff retry logic to handle temporary failures
- **Selectors**: The DOM selectors in `scraper.ts` may need adjustment if HOFOR changes their website structure

## TODO

- [ ] Update DOM selectors in `scraper.ts` based on actual HOFOR page structure
- [ ] Add support for multi-architecture Docker builds (arm64, armv7)
- [ ] Implement data caching to reduce duplicate scraping
- [ ] Add historical data collection
- [ ] Create GitHub Actions CI/CD pipeline
- [ ] Add more comprehensive error notifications

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
- Logging powered by [Winston](https://github.com/winstonjs/winston)
- Testing with [Vitest](https://vitest.dev/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
