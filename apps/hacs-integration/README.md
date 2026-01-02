# HOFOR Water - HACS Integration

A Home Assistant integration that reads HOFOR water consumption data from InfluxDB and creates sensors compatible with the Energy Dashboard.

## Features

- Reads water consumption data from InfluxDB
- Creates a sensor with `state_class: total_increasing` for Energy Dashboard compatibility
- Imports historical statistics with correct timestamps using `async_import_statistics`
- Configurable polling interval (1-24 hours)
- UI-based configuration via config flow

## Prerequisites

1. **HOFOR Scraper Addon** must be running and writing data to InfluxDB
2. **InfluxDB** must be accessible from Home Assistant
3. **HACS** installed in Home Assistant

## Installation

### Via HACS (Recommended)

1. Open HACS in Home Assistant
2. Go to **Integrations** → **⋮** → **Custom repositories**
3. Add `https://github.com/Jensen95/homeassistant-hofos` with category "Integration"
4. Install "HOFOR Water" from HACS
5. Restart Home Assistant
6. Add integration via **Settings** → **Devices & Services** → **Add Integration** → **HOFOR Water**

### Manual Installation

1. Copy `custom_components/hofor_water` to your `config/custom_components/` directory
2. Restart Home Assistant
3. Add integration via **Settings** → **Devices & Services** → **Add Integration** → **HOFOR Water**

## Configuration

### InfluxDB Settings

| Option | Description | Default |
|--------|-------------|---------|
| `influxdb_url` | InfluxDB server URL | `http://a0d7b954-influxdb:8086` |
| `influxdb_token` | API token with read access | (required) |
| `influxdb_org` | InfluxDB organization | `homeassistant` |
| `influxdb_bucket` | Bucket with water data | `homeassistant/autogen` |
| `poll_interval` | Hours between updates | `3` |

### Getting InfluxDB Token

1. Open InfluxDB UI (typically at `http://your-ha:8086`)
2. Go to **Data** → **Tokens**
3. Create a new token with read access to your bucket

## How It Works

### Data Flow

```
┌─────────────────┐     ┌──────────────┐     ┌────────────────────┐
│ HOFOR Scraper   │────►│   InfluxDB   │────►│ HOFOR Water        │
│ (writes data)   │     │ (stores data)│     │ Integration        │
└─────────────────┘     └──────────────┘     │ (reads & imports)  │
                                             └─────────┬──────────┘
                                                       │
                                             ┌─────────▼──────────┐
                                             │ Home Assistant     │
                                             │ Energy Dashboard   │
                                             └────────────────────┘
```

### Historical Data Handling

This integration correctly handles historical/backfilled data:

1. **Scraper** writes consumption data to InfluxDB with original reading timestamps
2. **Integration** queries InfluxDB for all available data
3. **Statistics Import** uses `async_import_statistics` to import data with correct historical timestamps
4. **Energy Dashboard** shows historical data on the correct days (not as a spike on the current day)

This means if 6 days of data are added to InfluxDB at once, the Energy Dashboard will show each day's consumption on the correct day, not as a single large value today.

### Sensor Attributes

The sensor provides:

- **State**: Latest consumption value (m³)
- **State Class**: `total_increasing` (compatible with Energy Dashboard)
- **Device Class**: `water`
- **Attributes**:
  - `last_reading_date`: Timestamp of the most recent reading
  - `data_source`: Always "influxdb"
  - `last_import_count`: Number of statistics imported in last update

## Energy Dashboard Setup

1. Go to **Settings** → **Dashboards** → **Energy**
2. Under **Water consumption**, click **Add water source**
3. Select the "HOFOR Water Consumption" sensor

The dashboard will now show:
- Daily water consumption
- Historical data (backfilled correctly)
- Cost calculations (if you configure a price)

## Development

### Prerequisites

- Python 3.12+
- pip

### Setup

```bash
cd apps/hacs-integration

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements-dev.txt
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=custom_components/hofor_water --cov-report=html

# Run specific test file
pytest tests/test_config_flow.py
```

### Linting

```bash
# Run ruff linter
ruff check .

# Run ruff formatter
ruff format .

# Run mypy type checking
mypy custom_components/hofor_water
```

## Troubleshooting

### No data appearing

1. Check the HOFOR Scraper addon is running
2. Verify data exists in InfluxDB:
   ```flux
   from(bucket: "homeassistant/autogen")
     |> range(start: -7d)
     |> filter(fn: (r) => r["_measurement"] == "water_consumption")
   ```
3. Check Home Assistant logs for errors

### Connection errors

1. Verify InfluxDB URL is correct
2. Check the token has read permissions
3. Ensure InfluxDB is accessible from Home Assistant

### Statistics not importing

1. Check the recorder component is enabled
2. Look for errors in Home Assistant logs
3. Verify the sensor entity exists in **Developer Tools** → **States**

## License

MIT License - See LICENSE file for details
