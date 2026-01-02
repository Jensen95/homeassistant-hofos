"""Tests for HOFOR Water config flow."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType

from custom_components.hofor_water.const import (
    CONF_INFLUXDB_BUCKET,
    CONF_INFLUXDB_ORG,
    CONF_INFLUXDB_TOKEN,
    CONF_INFLUXDB_URL,
    CONF_POLL_INTERVAL,
    DOMAIN,
)


async def test_form(hass: HomeAssistant, mock_config_flow_validate) -> None:
    """Test we get the form."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {}

    result2 = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {
            CONF_INFLUXDB_URL: "http://localhost:8086",
            CONF_INFLUXDB_TOKEN: "test-token",
            CONF_INFLUXDB_ORG: "test-org",
            CONF_INFLUXDB_BUCKET: "test-bucket",
            CONF_POLL_INTERVAL: 3,
        },
    )

    assert result2["type"] is FlowResultType.CREATE_ENTRY
    assert result2["title"] == "HOFOR Water"
    assert result2["data"] == {
        CONF_INFLUXDB_URL: "http://localhost:8086",
        CONF_INFLUXDB_TOKEN: "test-token",
        CONF_INFLUXDB_ORG: "test-org",
        CONF_INFLUXDB_BUCKET: "test-bucket",
        CONF_POLL_INTERVAL: 3,
    }


async def test_form_cannot_connect(hass: HomeAssistant) -> None:
    """Test we handle connection errors."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    with patch(
        "custom_components.hofor_water.config_flow.validate_influxdb_connection",
        return_value={"success": False, "error": "cannot_connect"},
    ):
        result2 = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_INFLUXDB_URL: "http://localhost:8086",
                CONF_INFLUXDB_TOKEN: "test-token",
                CONF_INFLUXDB_ORG: "test-org",
                CONF_INFLUXDB_BUCKET: "test-bucket",
                CONF_POLL_INTERVAL: 3,
            },
        )

    assert result2["type"] is FlowResultType.FORM
    assert result2["errors"] == {"base": "cannot_connect"}


async def test_form_invalid_auth(hass: HomeAssistant) -> None:
    """Test we handle invalid auth."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    with patch(
        "custom_components.hofor_water.config_flow.validate_influxdb_connection",
        return_value={"success": False, "error": "invalid_auth"},
    ):
        result2 = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_INFLUXDB_URL: "http://localhost:8086",
                CONF_INFLUXDB_TOKEN: "invalid-token",
                CONF_INFLUXDB_ORG: "test-org",
                CONF_INFLUXDB_BUCKET: "test-bucket",
                CONF_POLL_INTERVAL: 3,
            },
        )

    assert result2["type"] is FlowResultType.FORM
    assert result2["errors"] == {"base": "invalid_auth"}


async def test_form_no_data_warning(
    hass: HomeAssistant, mock_config_flow_validate
) -> None:
    """Test we still create entry when no data found (data may come later)."""
    mock_config_flow_validate.return_value = {"success": True, "has_data": False}

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    result2 = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {
            CONF_INFLUXDB_URL: "http://localhost:8086",
            CONF_INFLUXDB_TOKEN: "test-token",
            CONF_INFLUXDB_ORG: "test-org",
            CONF_INFLUXDB_BUCKET: "test-bucket",
            CONF_POLL_INTERVAL: 3,
        },
    )

    # Should still create entry even without data
    assert result2["type"] is FlowResultType.CREATE_ENTRY


async def test_form_already_configured(
    hass: HomeAssistant, mock_config_entry, mock_config_flow_validate
) -> None:
    """Test we handle already configured."""
    mock_config_entry.add_to_hass(hass)

    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    result2 = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {
            CONF_INFLUXDB_URL: "http://localhost:8086",
            CONF_INFLUXDB_TOKEN: "test-token",
            CONF_INFLUXDB_ORG: "test-org",
            CONF_INFLUXDB_BUCKET: "test-bucket",
            CONF_POLL_INTERVAL: 3,
        },
    )

    assert result2["type"] is FlowResultType.ABORT
    assert result2["reason"] == "already_configured"


async def test_form_poll_interval_validation(
    hass: HomeAssistant, mock_config_flow_validate
) -> None:
    """Test poll interval must be between 1 and 24."""
    result = await hass.config_entries.flow.async_init(
        DOMAIN, context={"source": config_entries.SOURCE_USER}
    )

    # Test valid interval (edge cases)
    result2 = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {
            CONF_INFLUXDB_URL: "http://localhost:8086",
            CONF_INFLUXDB_TOKEN: "test-token",
            CONF_INFLUXDB_ORG: "test-org",
            CONF_INFLUXDB_BUCKET: "test-bucket",
            CONF_POLL_INTERVAL: 1,  # Minimum valid
        },
    )

    assert result2["type"] is FlowResultType.CREATE_ENTRY
    assert result2["data"][CONF_POLL_INTERVAL] == 1
