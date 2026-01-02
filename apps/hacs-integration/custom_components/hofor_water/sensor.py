"""Sensor platform for HOFOR Water integration."""
from __future__ import annotations

import logging

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfVolume
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, SENSOR_NAME, SENSOR_UNIQUE_ID
from .coordinator import HoforWaterCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up HOFOR Water sensor based on a config entry."""
    coordinator: HoforWaterCoordinator = hass.data[DOMAIN][entry.entry_id]

    async_add_entities([HoforWaterSensor(coordinator, entry)])


class HoforWaterSensor(CoordinatorEntity[HoforWaterCoordinator], SensorEntity):
    """Representation of a HOFOR Water consumption sensor."""

    _attr_has_entity_name = True
    _attr_name = "Water Consumption"
    _attr_device_class = SensorDeviceClass.WATER
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_native_unit_of_measurement = UnitOfVolume.CUBIC_METERS
    _attr_suggested_display_precision = 3

    def __init__(
        self,
        coordinator: HoforWaterCoordinator,
        entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self._attr_unique_id = SENSOR_UNIQUE_ID
        self._entry = entry

        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="HOFOR Water Meter",
            manufacturer="HOFOR",
            model="Water Meter",
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def native_value(self) -> float | None:
        """Return the current water consumption value."""
        if self.coordinator.data is None:
            return None
        return self.coordinator.data.get("latest_value")

    @property
    def extra_state_attributes(self) -> dict[str, str | None]:
        """Return additional state attributes."""
        if self.coordinator.data is None:
            return {}

        return {
            "last_reading_date": self.coordinator.data.get("last_reading_date"),
            "data_source": "influxdb",
            "last_import_count": self.coordinator.data.get("imported_count", 0),
        }
