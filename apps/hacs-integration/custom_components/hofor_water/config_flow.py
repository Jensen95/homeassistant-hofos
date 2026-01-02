"""Config flow for HOFOR Water integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_INFLUXDB_BUCKET,
    CONF_INFLUXDB_ORG,
    CONF_INFLUXDB_TOKEN,
    CONF_INFLUXDB_URL,
    CONF_POLL_INTERVAL,
    DEFAULT_INFLUXDB_BUCKET,
    DEFAULT_INFLUXDB_ORG,
    DEFAULT_INFLUXDB_URL,
    DEFAULT_POLL_INTERVAL,
    DOMAIN,
    FIELD_VALUE,
    MEASUREMENT_WATER_CONSUMPTION,
)

_LOGGER = logging.getLogger(__name__)


async def validate_influxdb_connection(
    url: str, token: str, org: str, bucket: str
) -> dict[str, Any]:
    """Validate InfluxDB connection and check for water consumption data."""
    from influxdb_client import InfluxDBClient
    from influxdb_client.client.exceptions import InfluxDBError

    try:
        client = InfluxDBClient(url=url, token=token, org=org)
        query_api = client.query_api()

        # Test query to check for water consumption data
        query = f'''
        from(bucket: "{bucket}")
            |> range(start: -30d)
            |> filter(fn: (r) => r["_measurement"] == "{MEASUREMENT_WATER_CONSUMPTION}")
            |> filter(fn: (r) => r["_field"] == "{FIELD_VALUE}")
            |> last()
        '''

        tables = query_api.query(query)
        client.close()

        has_data = any(table.records for table in tables)

        return {"success": True, "has_data": has_data}

    except InfluxDBError as err:
        _LOGGER.error("InfluxDB error: %s", err)
        if "unauthorized" in str(err).lower():
            return {"success": False, "error": "invalid_auth"}
        return {"success": False, "error": "cannot_connect"}
    except Exception as err:
        _LOGGER.exception("Unexpected error connecting to InfluxDB: %s", err)
        return {"success": False, "error": "unknown"}


class HoforWaterConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle a config flow for HOFOR Water."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            # Validate connection
            result = await self.hass.async_add_executor_job(
                lambda: validate_influxdb_connection(
                    user_input[CONF_INFLUXDB_URL],
                    user_input[CONF_INFLUXDB_TOKEN],
                    user_input[CONF_INFLUXDB_ORG],
                    user_input[CONF_INFLUXDB_BUCKET],
                )
            )

            if result["success"]:
                if not result.get("has_data"):
                    _LOGGER.warning(
                        "Connected to InfluxDB but no water consumption data found"
                    )
                    # Still allow setup, data might come later
                    pass

                # Check if already configured
                await self.async_set_unique_id(DOMAIN)
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title="HOFOR Water",
                    data=user_input,
                )

            errors["base"] = result.get("error", "unknown")

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(
                        CONF_INFLUXDB_URL, default=DEFAULT_INFLUXDB_URL
                    ): str,
                    vol.Required(CONF_INFLUXDB_TOKEN): str,
                    vol.Required(
                        CONF_INFLUXDB_ORG, default=DEFAULT_INFLUXDB_ORG
                    ): str,
                    vol.Required(
                        CONF_INFLUXDB_BUCKET, default=DEFAULT_INFLUXDB_BUCKET
                    ): str,
                    vol.Required(
                        CONF_POLL_INTERVAL, default=DEFAULT_POLL_INTERVAL
                    ): vol.All(vol.Coerce(int), vol.Range(min=1, max=24)),
                }
            ),
            errors=errors,
        )
