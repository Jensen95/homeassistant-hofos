import { InfluxDB, Point } from '@influxdata/influxdb-client';
const MEASUREMENT_CONSUMPTION = 'water_consumption';
const MEASUREMENT_PRICE = 'water_price';
export class InfluxDBClient {
    logger;
    client;
    writeApi;
    constructor(config, logger) {
        this.logger = logger;
        this.client = new InfluxDB({ url: config.url, token: config.token });
        this.writeApi = this.client.getWriteApi(config.org, config.bucket);
        this.writeApi.useDefaultTags({ source: 'hofor-scraper' });
    }
    /**
     * Write consumption data to InfluxDB
     */
    async writeConsumption(data) {
        try {
            const point = new Point(MEASUREMENT_CONSUMPTION)
                .floatField('value', data.value)
                .tag('unit', data.unit)
                .timestamp(data.readingDate || data.timestamp);
            this.writeApi.writePoint(point);
            await this.writeApi.flush();
            this.logger.info(`Wrote consumption to InfluxDB: ${data.value} ${data.unit}`);
        }
        catch (error) {
            this.logger.error('Failed to write consumption to InfluxDB', { error });
            throw error;
        }
    }
    /**
     * Write price data to InfluxDB
     */
    async writePrice(data) {
        try {
            const point = new Point(MEASUREMENT_PRICE)
                .floatField('price_per_m3', data.pricePerM3)
                .tag('currency', data.currency)
                .timestamp(data.timestamp);
            this.writeApi.writePoint(point);
            await this.writeApi.flush();
            this.logger.info(`Wrote price to InfluxDB: ${data.pricePerM3} ${data.currency}/m³`);
        }
        catch (error) {
            this.logger.error('Failed to write price to InfluxDB', { error });
            throw error;
        }
    }
    /**
     * Write historical consumption data to InfluxDB
     */
    async writeHistoricalData(dataPoints) {
        try {
            let written = 0;
            for (const dataPoint of dataPoints) {
                const usage = parseFloat(dataPoint.usage.replace(',', '.'));
                if (isNaN(usage)) {
                    this.logger.warn(`Skipping invalid usage value: ${dataPoint.usage}`);
                    continue;
                }
                // Parse date in DD.MM.YYYY format
                const [day, month, year] = dataPoint.date.split('.');
                const timestamp = new Date(`${year}-${month}-${day}`);
                if (isNaN(timestamp.getTime())) {
                    this.logger.warn(`Skipping invalid date: ${dataPoint.date}`);
                    continue;
                }
                const point = new Point(MEASUREMENT_CONSUMPTION)
                    .floatField('value', usage)
                    .tag('unit', 'm³')
                    .tag('backfilled', 'true')
                    .timestamp(timestamp);
                this.writeApi.writePoint(point);
                written++;
            }
            await this.writeApi.flush();
            this.logger.info(`Wrote ${written} historical data points to InfluxDB`);
        }
        catch (error) {
            this.logger.error('Failed to write historical data to InfluxDB', { error });
            throw error;
        }
    }
    /**
     * Write both consumption and price data
     */
    async writeAll(consumption, price) {
        const errors = [];
        if (consumption) {
            try {
                await this.writeConsumption(consumption);
            }
            catch (error) {
                const msg = `Failed to write consumption: ${error.message}`;
                this.logger.error(msg);
                errors.push(msg);
            }
        }
        else {
            this.logger.warn('No consumption data to write');
        }
        if (price) {
            try {
                await this.writePrice(price);
            }
            catch (error) {
                const msg = `Failed to write price: ${error.message}`;
                this.logger.error(msg);
                errors.push(msg);
            }
        }
        else {
            this.logger.warn('No price data to write');
        }
        if (errors.length > 0) {
            throw new Error(`Writing errors: ${errors.join(', ')}`);
        }
    }
    /**
     * Close the InfluxDB client and flush any pending writes
     */
    async close() {
        try {
            await this.writeApi.close();
            this.logger.info('InfluxDB client closed');
        }
        catch (error) {
            this.logger.error('Error closing InfluxDB client', { error });
            throw error;
        }
    }
}
//# sourceMappingURL=influxdb.js.map