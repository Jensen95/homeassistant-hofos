# Home Assistant Add-on: HOFOR Scraper

## Installation

1. Add this repository to your Home Assistant Supervisor:
   - Navigate to **Supervisor** → **Add-on Store** → **⋮** (menu) → **Repositories**
   - Add: `https://github.com/Jensen95/homeassistant-hofos`

2. Find "HOFOR Scraper" in the add-on store and click **Install**

3. Configure the add-on (see Configuration section below)

4. Click **Start**

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

## Setup Guide

### Step 1: Install InfluxDB Add-on (if not already installed)

1. Go to **Supervisor** → **Add-on Store**
2. Search for "InfluxDB"
3. Install the official InfluxDB add-on
4. Configure and start it
5. Open the InfluxDB UI and create a token:
   - Navigate to **Data** → **Tokens**
   - Click **Generate Token** → **Read/Write Token**
   - Select buckets: `homeassistant/autogen`
   - Copy the generated token

### Step 2: Find Your HOFOR Credentials

Your HOFOR credentials can be found:

- **Kundenummer**: On your HOFOR bills or at https://prod.tastselvservice.dk
- **BS-Kundenummer**: Also on your bills, typically labeled as "BS-kunde nummer"

### Step 3: Configure HOFOR Scraper

Paste your credentials and InfluxDB token into the add-on configuration page.

### Step 4: Verify Installation

1. Start the add-on
2. Check the logs for successful connection and scraping
3. Open InfluxDB Data Explorer and query:

   ```flux
   from(bucket: "homeassistant/autogen")
     |> range(start: -7d)
     |> filter(fn: (r) => r["_measurement"] == "water_consumption")
   ```

## Data Structure

The add-on writes two measurements to InfluxDB:

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

## Visualization in Home Assistant

### Long-Term Statistics

The InfluxDB data can be visualized using:

1. **Grafana Add-on** - Full-featured dashboarding
2. **ApexCharts Card** - Custom HA dashboard cards
3. **InfluxDB Sensor** - Create template sensors

### Example: Create a Sensor

Add to `configuration.yaml`:

```yaml
sensor:
  - platform: influxdb
    host: a0d7b954-influxdb
    port: 8086
    token: !secret influxdb_token
    organization: homeassistant
    bucket: homeassistant/autogen
    queries:
      - name: Daily Water Consumption
        query: >
          from(bucket: "homeassistant/autogen")
            |> range(start: -1d)
            |> filter(fn: (r) => r["_measurement"] == "water_consumption")
            |> last()
        value_template: "{{ value }}"
        unit_of_measurement: "m³"
```

## Troubleshooting

### Add-on won't start

1. Check logs for error messages
2. Verify HOFOR credentials are correct
3. Ensure InfluxDB is running and accessible
4. Test InfluxDB token has read/write permissions

### No data appearing in InfluxDB

1. Check add-on logs for scraping errors
2. Verify you have consumption data on HOFOR's website
3. Check if backfilling completed (look for log message)
4. Ensure InfluxDB bucket name matches configuration

### "Authentication failed" errors

- Double-check your kundenummer and bs-kundenummer
- Verify you can log in at https://prod.tastselvservice.dk manually
- HOFOR may be down or undergoing maintenance

### Scraping failures

- HOFOR website may have changed structure (check for add-on updates)
- Network connectivity issues
- Rate limiting (reduce scrape frequency)

## Support

- **Issues**: https://github.com/Jensen95/homeassistant-hofos/issues

## License

MIT License - See LICENSE file for details
