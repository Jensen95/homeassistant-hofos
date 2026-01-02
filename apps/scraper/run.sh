#!/usr/bin/with-contenv bashio

export HOFOR_KUNDENUMMER=$(bashio::config 'hofor_kundenummer')
export HOFOR_BS_KUNDENUMMER=$(bashio::config 'hofor_bs_kundenummer')
export INFLUXDB_URL=$(bashio::config 'influxdb_url')
export INFLUXDB_TOKEN=$(bashio::config 'influxdb_token')
export INFLUXDB_ORG=$(bashio::config 'influxdb_org')
export INFLUXDB_BUCKET=$(bashio::config 'influxdb_bucket')
export WATER_PRICE_PER_M3=$(bashio::config 'water_price_per_m3')
export WATER_PRICE_CURRENCY=$(bashio::config 'water_price_currency')
export SCRAPE_INTERVAL_HOURS=$(bashio::config 'scrape_interval_hours')
export ENABLE_BACKFILL=$(bashio::config 'enable_backfill')
export BACKFILL_DAYS=$(bashio::config 'backfill_days')
export LOG_LEVEL=$(bashio::config 'log_level')
export HEADLESS=true

bashio::log.info "Starting HOFOR Scraper..."
bashio::log.info "Scrape interval: ${SCRAPE_INTERVAL_HOURS} hours"

cd /app
exec node dist/main.js
