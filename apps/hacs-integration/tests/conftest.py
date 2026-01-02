"""Pytest fixtures for HOFOR Water tests."""
from __future__ import annotations

from collections.abc import Generator
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.hofor_water.const import (
    CONF_INFLUXDB_BUCKET,
    CONF_INFLUXDB_ORG,
    CONF_INFLUXDB_TOKEN,
    CONF_INFLUXDB_URL,
    CONF_POLL_INTERVAL,
    DOMAIN,
)


@pytest.fixture(autouse=True)
def auto_enable_custom_integrations(enable_custom_integrations: None) -> None:
    """Enable custom integrations in Home Assistant."""
    return


@pytest.fixture
def mock_config_entry() -> MockConfigEntry:
    """Return a mock config entry."""
    return MockConfigEntry(
        domain=DOMAIN,
        title="HOFOR Water",
        data={
            CONF_INFLUXDB_URL: "http://localhost:8086",
            CONF_INFLUXDB_TOKEN: "test-token",
            CONF_INFLUXDB_ORG: "test-org",
            CONF_INFLUXDB_BUCKET: "test-bucket",
            CONF_POLL_INTERVAL: 3,
        },
        unique_id=DOMAIN,
    )


@pytest.fixture
def mock_influxdb_client() -> Generator[MagicMock, None, None]:
    """Mock the InfluxDB client."""
    with patch(
        "custom_components.hofor_water.coordinator.InfluxDBClient"
    ) as mock_client:
        # Create mock query API
        mock_query_api = MagicMock()
        mock_client.return_value.query_api.return_value = mock_query_api

        # Default: return empty tables
        mock_query_api.query.return_value = []

        yield mock_client


@pytest.fixture
def mock_influxdb_with_data() -> Generator[MagicMock, None, None]:
    """Mock InfluxDB client with sample data."""
    with patch(
        "custom_components.hofor_water.coordinator.InfluxDBClient"
    ) as mock_client:
        mock_query_api = MagicMock()
        mock_client.return_value.query_api.return_value = mock_query_api

        # Create mock records
        mock_record1 = MagicMock()
        mock_record1.get_time.return_value = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        mock_record1.get_value.return_value = 10.5

        mock_record2 = MagicMock()
        mock_record2.get_time.return_value = datetime(2024, 1, 2, 0, 0, 0, tzinfo=timezone.utc)
        mock_record2.get_value.return_value = 12.3

        # Create mock table
        mock_table = MagicMock()
        mock_table.records = [mock_record1, mock_record2]

        mock_query_api.query.return_value = [mock_table]

        yield mock_client


@pytest.fixture
def mock_config_flow_validate() -> Generator[MagicMock, None, None]:
    """Mock the config flow validation function."""
    with patch(
        "custom_components.hofor_water.config_flow.validate_influxdb_connection"
    ) as mock_validate:
        mock_validate.return_value = {"success": True, "has_data": True}
        yield mock_validate


@pytest.fixture
def mock_statistics() -> Generator[tuple[MagicMock, MagicMock], None, None]:
    """Mock statistics functions."""
    with patch(
        "custom_components.hofor_water.coordinator.async_add_external_statistics"
    ) as mock_add, patch(
        "custom_components.hofor_water.coordinator.get_last_statistics"
    ) as mock_get:
        mock_get.return_value = {}
        yield mock_add, mock_get


def create_mock_influxdb_record(
    time: datetime, value: float
) -> MagicMock:
    """Create a mock InfluxDB record."""
    record = MagicMock()
    record.get_time.return_value = time
    record.get_value.return_value = value
    return record


def create_mock_influxdb_response(
    records: list[tuple[datetime, float]]
) -> list[MagicMock]:
    """Create a mock InfluxDB query response."""
    mock_table = MagicMock()
    mock_table.records = [
        create_mock_influxdb_record(time, value) for time, value in records
    ]
    return [mock_table]
