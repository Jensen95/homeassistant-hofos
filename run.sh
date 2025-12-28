#!/usr/bin/with-contenv bashio

# Get options from Home Assistant
export HOFOR_USERNAME=$(bashio::config 'hofor_username')
export HOFOR_PASSWORD=$(bashio::config 'hofor_password')
export MQTT_BROKER=$(bashio::config 'mqtt_broker')
export MQTT_USERNAME=$(bashio::config 'mqtt_username')
export MQTT_PASSWORD=$(bashio::config 'mqtt_password')
export SCRAPE_INTERVAL_HOURS=$(bashio::config 'scrape_interval_hours')
export LOG_LEVEL=$(bashio::config 'log_level')
export HEADLESS=true

bashio::log.info "Starting HOFOR Scraper..."
bashio::log.info "Scrape interval: ${SCRAPE_INTERVAL_HOURS} hours"

# Start the application
cd /app
exec node dist/main.js
