"""Data coordinator for HOFOR Water integration."""
from __future__ import annotations

from datetime import datetime, timedelta
import logging
from typing import Any

from homeassistant.components.recorder import get_instance
from homeassistant.components.recorder.models import StatisticData, StatisticMetaData
from homeassistant.components.recorder.statistics import (
    async_add_external_statistics,
    get_last_statistics,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfVolume
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .const import (
    CONF_INFLUXDB_BUCKET,
    CONF_INFLUXDB_ORG,
    CONF_INFLUXDB_TOKEN,
    CONF_INFLUXDB_URL,
    CONF_POLL_INTERVAL,
    DEFAULT_POLL_INTERVAL,
    DOMAIN,
    FIELD_VALUE,
    MEASUREMENT_WATER_CONSUMPTION,
    STATISTICS_ID,
)

_LOGGER = logging.getLogger(__name__)


class HoforWaterCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator to fetch water consumption data from InfluxDB."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize the coordinator."""
        self._entry = entry
        self._influxdb_url = entry.data[CONF_INFLUXDB_URL]
        self._influxdb_token = entry.data[CONF_INFLUXDB_TOKEN]
        self._influxdb_org = entry.data[CONF_INFLUXDB_ORG]
        self._influxdb_bucket = entry.data[CONF_INFLUXDB_BUCKET]
        self._poll_interval = entry.data.get(CONF_POLL_INTERVAL, DEFAULT_POLL_INTERVAL)
        self._last_import_time: datetime | None = None

        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(hours=self._poll_interval),
        )

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from InfluxDB and import statistics."""
        try:
            # Query InfluxDB for data
            data = await self.hass.async_add_executor_job(self._query_influxdb)

            if data["records"]:
                # Import historical statistics
                imported_count = await self._import_statistics(data["records"])
                data["imported_count"] = imported_count

            return data

        except Exception as err:
            _LOGGER.exception("Error fetching data from InfluxDB")
            raise UpdateFailed(f"Error communicating with InfluxDB: {err}") from err

    def _query_influxdb(self) -> dict[str, Any]:
        """Query InfluxDB for water consumption data."""
        from influxdb_client import InfluxDBClient

        client = InfluxDBClient(
            url=self._influxdb_url,
            token=self._influxdb_token,
            org=self._influxdb_org,
        )
        query_api = client.query_api()

        # Determine the start time for the query
        # If we have imported before, only get new data
        # Otherwise, get all available data (up to 2 years)
        if self._last_import_time:
            start_time = self._last_import_time.isoformat()
            range_clause = f'start: {start_time}'
        else:
            range_clause = 'start: -730d'

        query = f'''
        from(bucket: "{self._influxdb_bucket}")
            |> range({range_clause})
            |> filter(fn: (r) => r["_measurement"] == "{MEASUREMENT_WATER_CONSUMPTION}")
            |> filter(fn: (r) => r["_field"] == "{FIELD_VALUE}")
            |> sort(columns: ["_time"])
        '''

        _LOGGER.debug("Executing InfluxDB query: %s", query)

        tables = query_api.query(query)
        client.close()

        records: list[dict[str, Any]] = []
        latest_value: float | None = None
        last_reading_date: str | None = None

        for table in tables:
            for record in table.records:
                records.append({
                    "time": record.get_time(),
                    "value": record.get_value(),
                })
                latest_value = record.get_value()
                last_reading_date = record.get_time().isoformat()

        _LOGGER.debug("Found %d records from InfluxDB", len(records))

        return {
            "records": records,
            "latest_value": latest_value,
            "last_reading_date": last_reading_date,
        }

    async def _import_statistics(
        self, records: list[dict[str, Any]]
    ) -> int:
        """Import historical statistics from InfluxDB records."""
        if not records:
            return 0

        # Get the last known statistic to avoid duplicates
        last_stats = await get_instance(self.hass).async_add_executor_job(
            get_last_statistics, self.hass, 1, STATISTICS_ID, True, {"sum"}
        )

        last_sum: float = 0.0
        last_time: datetime | None = None

        if last_stats and STATISTICS_ID in last_stats:
            last_stat = last_stats[STATISTICS_ID][0]
            last_sum = last_stat.get("sum", 0.0) or 0.0
            last_time = dt_util.utc_from_timestamp(last_stat["start"])
            _LOGGER.debug("Last known statistic: sum=%s at %s", last_sum, last_time)

        # Filter records to only include new ones
        new_records = [
            r for r in records
            if last_time is None or r["time"] > last_time
        ]

        if not new_records:
            _LOGGER.debug("No new records to import")
            return 0

        # Create statistics metadata
        metadata = StatisticMetaData(
            has_mean=False,
            has_sum=True,
            name="HOFOR Water Consumption",
            source=DOMAIN,
            statistic_id=STATISTICS_ID,
            unit_of_measurement=UnitOfVolume.CUBIC_METERS,
        )

        # Build statistics data
        # Each record represents daily consumption, so we accumulate
        statistics: list[StatisticData] = []
        running_sum = last_sum

        for record in new_records:
            value = record["value"]
            if value is None:
                continue

            running_sum += value

            # Round to the start of the hour for statistics
            record_time = record["time"]
            if record_time.tzinfo is None:
                record_time = record_time.replace(tzinfo=dt_util.UTC)

            hour_start = record_time.replace(minute=0, second=0, microsecond=0)

            statistics.append(
                StatisticData(
                    start=hour_start,
                    sum=running_sum,
                    state=value,
                )
            )

        if statistics:
            _LOGGER.info("Importing %d statistics records", len(statistics))
            async_add_external_statistics(self.hass, metadata, statistics)

            # Update last import time
            self._last_import_time = new_records[-1]["time"]

        return len(statistics)
