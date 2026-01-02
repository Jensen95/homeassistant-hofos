"""Constants for the HOFOR Water integration."""
from typing import Final

DOMAIN: Final = "hofor_water"

# Configuration keys
CONF_INFLUXDB_URL: Final = "influxdb_url"
CONF_INFLUXDB_TOKEN: Final = "influxdb_token"
CONF_INFLUXDB_ORG: Final = "influxdb_org"
CONF_INFLUXDB_BUCKET: Final = "influxdb_bucket"
CONF_POLL_INTERVAL: Final = "poll_interval"

# Default values
DEFAULT_INFLUXDB_URL: Final = "http://a0d7b954-influxdb:8086"
DEFAULT_INFLUXDB_ORG: Final = "homeassistant"
DEFAULT_INFLUXDB_BUCKET: Final = "homeassistant/autogen"
DEFAULT_POLL_INTERVAL: Final = 3  # hours

# InfluxDB query constants
MEASUREMENT_WATER_CONSUMPTION: Final = "water_consumption"
FIELD_VALUE: Final = "value"
TAG_UNIT: Final = "unit"
TAG_SOURCE: Final = "source"

# Sensor constants
SENSOR_NAME: Final = "HOFOR Water Consumption"
SENSOR_UNIQUE_ID: Final = "hofor_water_consumption"

# Statistics
STATISTICS_ID: Final = f"sensor.{SENSOR_UNIQUE_ID}"
