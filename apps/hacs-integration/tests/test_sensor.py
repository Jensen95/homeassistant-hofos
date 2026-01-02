"""Tests for HOFOR Water sensor."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from homeassistant.components.sensor import SensorDeviceClass, SensorStateClass
from homeassistant.const import UnitOfVolume
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from custom_components.hofor_water.const import DOMAIN, SENSOR_UNIQUE_ID


async def test_sensor_setup(
    hass: HomeAssistant,
    mock_config_entry,
    mock_influxdb_with_data,
    mock_statistics,
) -> None:
    """Test sensor is set up correctly."""
    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    state = hass.states.get(f"sensor.{SENSOR_UNIQUE_ID}")
    assert state is not None
    assert state.state == "12.3"  # Latest value from mock data


async def test_sensor_attributes(
    hass: HomeAssistant,
    mock_config_entry,
    mock_influxdb_with_data,
    mock_statistics,
) -> None:
    """Test sensor has correct attributes."""
    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    state = hass.states.get(f"sensor.{SENSOR_UNIQUE_ID}")
    assert state is not None

    # Check device class and state class
    assert state.attributes.get("device_class") == SensorDeviceClass.WATER
    assert state.attributes.get("state_class") == SensorStateClass.TOTAL_INCREASING
    assert state.attributes.get("unit_of_measurement") == UnitOfVolume.CUBIC_METERS

    # Check custom attributes
    assert state.attributes.get("data_source") == "influxdb"
    assert state.attributes.get("last_reading_date") is not None


async def test_sensor_no_data(
    hass: HomeAssistant,
    mock_config_entry,
    mock_influxdb_client,
    mock_statistics,
) -> None:
    """Test sensor when no data is available."""
    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    state = hass.states.get(f"sensor.{SENSOR_UNIQUE_ID}")
    assert state is not None
    assert state.state == "unknown"


async def test_sensor_entity_registry(
    hass: HomeAssistant,
    mock_config_entry,
    mock_influxdb_with_data,
    mock_statistics,
) -> None:
    """Test sensor is registered in entity registry."""
    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    registry = er.async_get(hass)
    entity = registry.async_get(f"sensor.{SENSOR_UNIQUE_ID}")

    assert entity is not None
    assert entity.unique_id == SENSOR_UNIQUE_ID
    assert entity.platform == DOMAIN


async def test_sensor_device_info(
    hass: HomeAssistant,
    mock_config_entry,
    mock_influxdb_with_data,
    mock_statistics,
) -> None:
    """Test sensor has correct device info."""
    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    state = hass.states.get(f"sensor.{SENSOR_UNIQUE_ID}")
    assert state is not None

    registry = er.async_get(hass)
    entity = registry.async_get(f"sensor.{SENSOR_UNIQUE_ID}")
    assert entity is not None

    # Device should be linked
    assert entity.device_id is not None


async def test_sensor_updates_on_coordinator_update(
    hass: HomeAssistant,
    mock_config_entry,
    mock_statistics,
) -> None:
    """Test sensor updates when coordinator fetches new data."""
    with patch(
        "custom_components.hofor_water.coordinator.InfluxDBClient"
    ) as mock_client:
        mock_query_api = MagicMock()
        mock_client.return_value.query_api.return_value = mock_query_api

        # Initial data
        mock_record = MagicMock()
        mock_record.get_time.return_value = datetime(
            2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc
        )
        mock_record.get_value.return_value = 10.0
        mock_table = MagicMock()
        mock_table.records = [mock_record]
        mock_query_api.query.return_value = [mock_table]

        mock_config_entry.add_to_hass(hass)
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        state = hass.states.get(f"sensor.{SENSOR_UNIQUE_ID}")
        assert state.state == "10.0"

        # Update data
        mock_record2 = MagicMock()
        mock_record2.get_time.return_value = datetime(
            2024, 1, 2, 0, 0, 0, tzinfo=timezone.utc
        )
        mock_record2.get_value.return_value = 15.5
        mock_table.records = [mock_record, mock_record2]

        # Trigger coordinator update
        coordinator = hass.data[DOMAIN][mock_config_entry.entry_id]
        await coordinator.async_refresh()
        await hass.async_block_till_done()

        state = hass.states.get(f"sensor.{SENSOR_UNIQUE_ID}")
        assert state.state == "15.5"
