"""Tests for HOFOR Water coordinator."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import UpdateFailed

from custom_components.hofor_water.const import DOMAIN, STATISTICS_ID
from custom_components.hofor_water.coordinator import HoforWaterCoordinator


async def test_coordinator_fetch_data(
    hass: HomeAssistant,
    mock_config_entry,
    mock_influxdb_with_data,
    mock_statistics,
) -> None:
    """Test coordinator fetches data from InfluxDB."""
    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    coordinator = hass.data[DOMAIN][mock_config_entry.entry_id]

    assert coordinator.data is not None
    assert coordinator.data["latest_value"] == 12.3
    assert coordinator.data["last_reading_date"] is not None
    assert len(coordinator.data["records"]) == 2


async def test_coordinator_imports_statistics(
    hass: HomeAssistant,
    mock_config_entry,
    mock_influxdb_with_data,
    mock_statistics,
) -> None:
    """Test coordinator imports statistics correctly."""
    mock_add_stats, mock_get_stats = mock_statistics

    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    # Verify statistics were imported
    assert mock_add_stats.called

    # Check the metadata passed to async_add_external_statistics
    call_args = mock_add_stats.call_args
    metadata = call_args[0][1]  # Second positional argument
    assert metadata.statistic_id == STATISTICS_ID
    assert metadata.source == DOMAIN
    assert metadata.has_sum is True


async def test_coordinator_incremental_import(
    hass: HomeAssistant,
    mock_config_entry,
    mock_statistics,
) -> None:
    """Test coordinator only imports new records after first import."""
    mock_add_stats, mock_get_stats = mock_statistics

    # Set up existing statistics
    mock_get_stats.return_value = {
        STATISTICS_ID: [
            {
                "start": datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc).timestamp(),
                "sum": 10.5,
            }
        ]
    }

    with patch(
        "custom_components.hofor_water.coordinator.InfluxDBClient"
    ) as mock_client:
        mock_query_api = MagicMock()
        mock_client.return_value.query_api.return_value = mock_query_api

        # Return records including old and new
        mock_record1 = MagicMock()
        mock_record1.get_time.return_value = datetime(
            2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc
        )
        mock_record1.get_value.return_value = 10.5

        mock_record2 = MagicMock()
        mock_record2.get_time.return_value = datetime(
            2024, 1, 2, 0, 0, 0, tzinfo=timezone.utc
        )
        mock_record2.get_value.return_value = 12.3

        mock_table = MagicMock()
        mock_table.records = [mock_record1, mock_record2]
        mock_query_api.query.return_value = [mock_table]

        mock_config_entry.add_to_hass(hass)
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # Should only import the new record (2024-01-02)
        call_args = mock_add_stats.call_args
        statistics = call_args[0][2]  # Third positional argument
        assert len(statistics) == 1


async def test_coordinator_handles_empty_data(
    hass: HomeAssistant,
    mock_config_entry,
    mock_influxdb_client,
    mock_statistics,
) -> None:
    """Test coordinator handles empty InfluxDB response."""
    mock_config_entry.add_to_hass(hass)
    await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    coordinator = hass.data[DOMAIN][mock_config_entry.entry_id]

    assert coordinator.data is not None
    assert coordinator.data["latest_value"] is None
    assert coordinator.data["records"] == []


async def test_coordinator_handles_connection_error(
    hass: HomeAssistant,
    mock_config_entry,
    mock_statistics,
) -> None:
    """Test coordinator handles InfluxDB connection errors."""
    with patch(
        "custom_components.hofor_water.coordinator.InfluxDBClient"
    ) as mock_client:
        mock_client.side_effect = Exception("Connection refused")

        mock_config_entry.add_to_hass(hass)

        # Should raise UpdateFailed
        with pytest.raises(Exception):
            await hass.config_entries.async_setup(mock_config_entry.entry_id)


async def test_coordinator_accumulates_sum(
    hass: HomeAssistant,
    mock_config_entry,
    mock_statistics,
) -> None:
    """Test coordinator correctly accumulates sum in statistics."""
    mock_add_stats, mock_get_stats = mock_statistics

    with patch(
        "custom_components.hofor_water.coordinator.InfluxDBClient"
    ) as mock_client:
        mock_query_api = MagicMock()
        mock_client.return_value.query_api.return_value = mock_query_api

        # Multiple records
        records = []
        for i in range(3):
            record = MagicMock()
            record.get_time.return_value = datetime(
                2024, 1, i + 1, 0, 0, 0, tzinfo=timezone.utc
            )
            record.get_value.return_value = 10.0 + i  # 10.0, 11.0, 12.0
            records.append(record)

        mock_table = MagicMock()
        mock_table.records = records
        mock_query_api.query.return_value = [mock_table]

        mock_config_entry.add_to_hass(hass)
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # Check statistics have accumulated sums
        call_args = mock_add_stats.call_args
        statistics = call_args[0][2]

        assert len(statistics) == 3
        assert statistics[0].sum == 10.0  # First: 10.0
        assert statistics[1].sum == 21.0  # Second: 10.0 + 11.0
        assert statistics[2].sum == 33.0  # Third: 10.0 + 11.0 + 12.0


async def test_coordinator_handles_none_values(
    hass: HomeAssistant,
    mock_config_entry,
    mock_statistics,
) -> None:
    """Test coordinator skips None values in records."""
    mock_add_stats, mock_get_stats = mock_statistics

    with patch(
        "custom_components.hofor_water.coordinator.InfluxDBClient"
    ) as mock_client:
        mock_query_api = MagicMock()
        mock_client.return_value.query_api.return_value = mock_query_api

        # Record with None value
        mock_record1 = MagicMock()
        mock_record1.get_time.return_value = datetime(
            2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc
        )
        mock_record1.get_value.return_value = None

        mock_record2 = MagicMock()
        mock_record2.get_time.return_value = datetime(
            2024, 1, 2, 0, 0, 0, tzinfo=timezone.utc
        )
        mock_record2.get_value.return_value = 12.0

        mock_table = MagicMock()
        mock_table.records = [mock_record1, mock_record2]
        mock_query_api.query.return_value = [mock_table]

        mock_config_entry.add_to_hass(hass)
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # Should only have one statistic (None skipped)
        call_args = mock_add_stats.call_args
        statistics = call_args[0][2]
        assert len(statistics) == 1
        assert statistics[0].sum == 12.0
