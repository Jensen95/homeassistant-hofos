# Home Assistant Add-on: HOFOR Scraper

This add-on scrapes HOFOR (Copenhagen Water) consumption data and stores it in InfluxDB for use with Home Assistant.

## Quick Links

- 🚀 [Installation](#installation)
- ⚙️ [Configuration](#configuration)  
- 📊 [Energy Dashboard Integration](#energy-dashboard-integration-recommended) (Most Popular)
- 🔍 [Troubleshooting](#troubleshooting)
- 📈 [Data Structure](#data-structure)

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

**Important for Energy Dashboard:**
- Each data point represents consumption for a specific date
- The timestamp is the reading date, not the current time
- Backfilled data has timestamps in the past (e.g., 365 days ago)
- To use with Energy Dashboard, you need to sum all values to create a cumulative total
- You may want to filter out `backfilled: "true"` data to avoid confusion

### water_price (optional)

- **Field:** `price_per_m3` (float) - Price per cubic meter
- **Tags:**
  - `currency`: Configured currency (e.g., "DKK")
  - `source`: "hofor-scraper"
- **Timestamp:** Current time

## Visualization in Home Assistant

### Long-Term Statistics

The InfluxDB data can be visualized using:

1. **Energy Dashboard** - Native Home Assistant energy monitoring (recommended)
2. **Grafana Add-on** - Full-featured dashboarding
3. **ApexCharts Card** - Custom HA dashboard cards
4. **InfluxDB Sensor** - Create template sensors

### Energy Dashboard Integration (Recommended)

The Home Assistant Energy Dashboard provides native water consumption tracking. To use the HOFOR scraper data with the Energy Dashboard, you need to create a sensor that provides **cumulative** water consumption data.

#### Step 1: Create a Cumulative Water Sensor

Add the following to your `configuration.yaml`:

```yaml
# Template sensor that calculates cumulative water consumption from InfluxDB
template:
  - sensor:
      - name: "Water Consumption Total"
        unique_id: water_consumption_total
        state_class: total_increasing
        device_class: water
        unit_of_measurement: "m³"
        state: >
          {% set query = "from(bucket: \"homeassistant/autogen\")
            |> range(start: 0)
            |> filter(fn: (r) => r[\"_measurement\"] == \"water_consumption\")
            |> filter(fn: (r) => r[\"_field\"] == \"value\")
            |> sum()" %}
          {{ states('sensor.hofor_water_total') | float(0) }}
        availability: >
          {{ states('sensor.hofor_water_total') not in ['unavailable', 'unknown', 'none'] }}
```

#### Step 2: Create an InfluxDB Integration Sensor

You'll need the InfluxDB integration to query the data. Add this to `configuration.yaml`:

```yaml
sensor:
  - platform: influxdb
    host: a0d7b954-influxdb
    port: 8086
    token: !secret influxdb_token
    organization: homeassistant
    bucket: homeassistant/autogen
    queries:
      # Total cumulative water consumption
      - name: HOFOR Water Total
        unique_id: hofor_water_total
        query: >
          from(bucket: "homeassistant/autogen")
            |> range(start: 0)
            |> filter(fn: (r) => r["_measurement"] == "water_consumption")
            |> filter(fn: (r) => r["_field"] == "value")
            |> sum()
        value_template: "{{ value | float(0) }}"
        unit_of_measurement: "m³"
        state_class: total_increasing
        device_class: water
        
      # Daily water consumption (for reference)
      - name: HOFOR Water Daily
        unique_id: hofor_water_daily
        query: >
          from(bucket: "homeassistant/autogen")
            |> range(start: -1d)
            |> filter(fn: (r) => r["_measurement"] == "water_consumption")
            |> filter(fn: (r) => r["_field"] == "value")
            |> last()
        value_template: "{{ value | float(0) }}"
        unit_of_measurement: "m³"
        state_class: measurement
        device_class: water
```

**Important Notes:**
- The `state_class: total_increasing` is required for the Energy Dashboard to recognize this as a cumulative consumption sensor
- The `device_class: water` ensures proper categorization in the Energy Dashboard
- The sensor will show the total cumulative consumption since the beginning of your data

#### Step 3: Add Sensor to Energy Dashboard

1. Navigate to **Settings** → **Dashboards** → **Energy**
2. Click **Add Consumption** in the "Water Consumption" section
3. Select **Water Consumption Total** from the dropdown
4. Configure the cost per m³ if desired (or leave it to track from the `water_price` measurement)
5. Click **Save**

#### Step 4: Configure Water Pricing (Optional)

If you want to track water costs in the Energy Dashboard, you can either:

**Option A: Configure in the addon** (recommended)
Set `water_price_per_m3` in the addon configuration to your current water price. The addon will store this in InfluxDB.

**Option B: Configure in Energy Dashboard**
Manually enter the price per m³ in the Energy Dashboard settings.

### Alternative: RESTful Sensor for Energy Dashboard

If you prefer not to use the InfluxDB integration, you can create a RESTful sensor that queries InfluxDB's HTTP API:

```yaml
sensor:
  - platform: rest
    name: "Water Consumption Total"
    unique_id: water_consumption_total_rest
    resource: "http://a0d7b954-influxdb:8086/api/v2/query?org=homeassistant"
    method: POST
    headers:
      Authorization: "Token YOUR_INFLUXDB_TOKEN"
      Content-Type: "application/vnd.flux"
    payload: >
      from(bucket: "homeassistant/autogen")
        |> range(start: 0)
        |> filter(fn: (r) => r["_measurement"] == "water_consumption")
        |> filter(fn: (r) => r["_field"] == "value")
        |> sum()
    value_template: >
      {% set data = value_json._results[0]._tables[0]._records %}
      {% if data | length > 0 %}
        {{ data[0]._value | float(0) }}
      {% else %}
        0
      {% endif %}
    unit_of_measurement: "m³"
    state_class: total_increasing
    device_class: water
    scan_interval: 3600
```

**Note:** This approach requires manual JSON parsing and may be less reliable than the InfluxDB integration.

### Basic Sensor Example (Non-Energy Dashboard)

For general monitoring outside the Energy Dashboard, add to `configuration.yaml`:

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

### Energy Dashboard Issues

#### Sensor not appearing in Energy Dashboard

1. **Verify sensor attributes:**
   - Ensure `state_class: total_increasing` is set
   - Ensure `device_class: water` is set
   - Ensure `unit_of_measurement: "m³"` is set

2. **Check sensor state:**
   - Go to **Developer Tools** → **States**
   - Search for your water sensor
   - Verify it has a numeric value (not "unavailable" or "unknown")
   - Check that the attributes match the requirements above

3. **Restart Home Assistant:**
   - Sometimes the Energy Dashboard needs a restart to recognize new sensors
   - Go to **Settings** → **System** → **Restart**

#### Data not updating in Energy Dashboard

1. **Check InfluxDB sensor update frequency:**
   - The InfluxDB sensor may have a long `scan_interval`
   - Default is usually 60 seconds, but can be adjusted
   - Add `scan_interval: 300` (5 minutes) if needed

2. **Verify data is being written to InfluxDB:**
   - Open InfluxDB Data Explorer
   - Run the query from your sensor configuration
   - Ensure data points are being written

3. **Check backfilled data tag:**
   - The Energy Dashboard may filter out backfilled data
   - Ensure recent scrapes are creating non-backfilled data points
   - Check addon logs for recent scrape activity

#### Cumulative sensor shows wrong total

1. **Recalculate from scratch:**
   - The `range(start: 0)` query sums ALL data points
   - If you have duplicate data, this may show inflated numbers
   - Consider using `range(start: -365d)` for last year only

2. **Check for duplicate data points:**
   - InfluxDB should handle duplicates by timestamp automatically
   - Run this query to check for duplicates:
     ```flux
     from(bucket: "homeassistant/autogen")
       |> range(start: -30d)
       |> filter(fn: (r) => r["_measurement"] == "water_consumption")
       |> filter(fn: (r) => r["_field"] == "value")
       |> group(columns: ["_time"])
       |> count()
       |> filter(fn: (r) => r._value > 1)
     ```

3. **Backfill considerations:**
   - If you disabled backfilling (`enable_backfill: false`), historical data won't be loaded
   - If you re-enabled backfilling, it may create duplicate data
   - Consider starting fresh with a new bucket if data is inconsistent

#### Energy Dashboard shows negative values

- This usually indicates the sensor is not properly configured as `total_increasing`
- Ensure the Flux query returns a cumulative sum, not individual daily values
- Consider using `|> cumulativeSum()` in your Flux query if needed

#### Cost tracking not working

1. **Check water price configuration:**
   - Verify `water_price_per_m3` is set in addon configuration (not 0)
   - Check that `water_price` measurement exists in InfluxDB

2. **Alternative: Configure cost in Energy Dashboard:**
   - You can manually set the cost per m³ in the Energy Dashboard
   - This may be more reliable than querying from InfluxDB

### Backfilling Issues

#### Backfill breaks Energy Dashboard

**Problem:** When backfilling historical data, the Energy Dashboard may show incorrect consumption for the current period.

**Explanation:** InfluxDB stores data points with their original timestamps. When backfilling, data is written with dates from the past (e.g., 365 days ago). The Energy Dashboard reads this as historical consumption, not current consumption.

**Solution:**
1. **Use the `backfilled` tag to filter:**
   ```yaml
   query: >
     from(bucket: "homeassistant/autogen")
       |> range(start: 0)
       |> filter(fn: (r) => r["_measurement"] == "water_consumption")
       |> filter(fn: (r) => r["_field"] == "value")
       |> filter(fn: (r) => r["backfilled"] != "true")
       |> sum()
   ```

2. **Start fresh if needed:**
   - Delete the InfluxDB bucket and recreate it
   - Set `enable_backfill: false` in addon configuration
   - Let the addon collect only fresh data going forward

3. **Use separate sensors:**
   - Create one sensor for total (including backfilled)
   - Create another sensor for energy dashboard (excluding backfilled)
   - This gives you both historical view and accurate current tracking

### Scraping failures

- HOFOR website may have changed structure (check for add-on updates)
- Network connectivity issues
- Rate limiting (reduce scrape frequency)

## Frequently Asked Questions

### Does backfilling break the Energy Dashboard?

**Short answer:** It depends on your sensor configuration.

**Explanation:** When you backfill data, InfluxDB stores data points with their original timestamps (e.g., data from 365 days ago has a timestamp 365 days in the past). The Energy Dashboard uses these timestamps to calculate consumption for specific periods.

**Solutions:**
1. **Filter out backfilled data** in your Energy Dashboard sensor (recommended):
   ```yaml
   |> filter(fn: (r) => r["backfilled"] != "true")
   ```

2. **Don't backfill** if you only care about tracking from now forward:
   ```yaml
   enable_backfill: false
   ```

3. **Use the import feature** (advanced): Create a separate sensor for historical import that the Energy Dashboard can use for historical data without affecting current tracking.

### Can I use this with the Home Assistant Energy Dashboard?

**Yes!** See the [Energy Dashboard Integration](#energy-dashboard-integration-recommended) section for detailed setup instructions.

The key requirements are:
- Create a sensor with `state_class: total_increasing`
- Set `device_class: water`
- Use a Flux query that returns cumulative consumption (sum of all data points)
- Optionally filter out backfilled data to avoid confusion

### What's the difference between InfluxDB sensor and RESTful sensor?

**InfluxDB Integration** (recommended):
- Native Home Assistant integration
- Better error handling and retry logic
- Automatic state management
- Easier configuration

**RESTful Sensor**:
- No additional integration required
- More manual JSON parsing
- Can be less reliable
- Useful if InfluxDB integration isn't available

For most users, the InfluxDB integration is the better choice.

### How often should I scrape?

**Recommended:** Every 3 hours (default)

**Reasoning:**
- HOFOR typically updates consumption data once per day
- Data may be 1-2 days delayed
- More frequent scraping doesn't give you more data, just more load on HOFOR's servers
- The addon has retry logic, so occasional failures are handled automatically

### Can I use this without InfluxDB?

Not directly. This addon is designed to write data to InfluxDB, which then serves as the data source for Home Assistant sensors.

**Why InfluxDB?**
- Optimized for time-series data (perfect for consumption tracking)
- Handles historical data and backfilling elegantly
- Powerful query language (Flux) for aggregations and transformations
- Native support in Home Assistant

**Alternative approach:** You could modify the addon to write directly to Home Assistant's long-term statistics, but this would require significant code changes and is not currently supported.

### What happens to old data?

By default, InfluxDB retains data indefinitely. You can configure retention policies in InfluxDB to automatically delete old data after a certain period (e.g., keep only 2 years of data).

**To configure retention:**
1. Open the InfluxDB UI
2. Navigate to **Data** → **Buckets**
3. Edit your bucket's retention policy
4. Set the desired retention period (e.g., 730 days for 2 years)

### Can I import this data into other systems?

Yes! InfluxDB has a REST API and supports various export formats:
- CSV export via the UI
- Flux queries via the API
- Grafana integration
- Direct database connections for analytics tools

## Support

- **Issues**: https://github.com/Jensen95/homeassistant-hofos/issues
- **Discussions**: Use GitHub Discussions for questions and feature requests

## License

MIT License - See LICENSE file for details
