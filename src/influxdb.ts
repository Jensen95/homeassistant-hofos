import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';
import { Logger } from 'winston';

import type {
  ConsumptionData,
  HistoricalDataPoint,
  InfluxDBConfig,
  PriceData,
} from './influxdb.types.js';

const MEASUREMENT_CONSUMPTION = 'water_consumption';
const MEASUREMENT_PRICE = 'water_price';

export class InfluxDBClient {
  private client: InfluxDB;
  private writeApi: WriteApi;

  constructor(
    config: InfluxDBConfig,
    private readonly logger: Logger
  ) {
    this.client = new InfluxDB({ token: config.token, url: config.url });
    this.writeApi = this.client.getWriteApi(config.org, config.bucket);
    this.writeApi.useDefaultTags({ source: 'hofor-scraper' });
  }

  async close(): Promise<void> {
    try {
      await this.writeApi.close();
      this.logger.info('InfluxDB client closed');
    } catch (error) {
      this.logger.error('Error closing InfluxDB client', { error });
      throw error;
    }
  }

  async writeAll(consumption: ConsumptionData | null, price: PriceData | null): Promise<void> {
    const errors: string[] = [];

    if (consumption) {
      try {
        await this.writeConsumption(consumption);
      } catch (error) {
        const message = `Failed to write consumption: ${(error as Error).message}`;
        this.logger.error(message);
        errors.push(message);
      }
    } else {
      this.logger.warn('No consumption data to write');
    }

    if (price) {
      try {
        await this.writePrice(price);
      } catch (error) {
        const message = `Failed to write price: ${(error as Error).message}`;
        this.logger.error(message);
        errors.push(message);
      }
    } else {
      this.logger.warn('No price data to write');
    }

    if (errors.length > 0) {
      throw new Error(`Writing errors: ${errors.join(', ')}`);
    }
  }

  async writeConsumption(data: ConsumptionData): Promise<void> {
    try {
      const point = new Point(MEASUREMENT_CONSUMPTION)
        .floatField('value', data.value)
        .tag('unit', data.unit)
        .timestamp(data.readingDate || data.timestamp);

      this.writeApi.writePoint(point);
      await this.writeApi.flush();

      this.logger.info(`Wrote consumption to InfluxDB: ${data.value} ${data.unit}`);
    } catch (error) {
      this.logger.error('Failed to write consumption to InfluxDB', { error });
      throw error;
    }
  }

  async writeHistoricalData(dataPoints: HistoricalDataPoint[]): Promise<void> {
    try {
      let written = 0;
      for (const dataPoint of dataPoints) {
        const usage = this.parseDecimalValue(dataPoint.usage);
        if (Number.isNaN(usage)) {
          this.logger.warn(`Skipping invalid usage value: ${dataPoint.usage}`);
          continue;
        }

        const timestamp = this.parseDate(dataPoint.date);
        if (!timestamp) {
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
    } catch (error) {
      this.logger.error('Failed to write historical data to InfluxDB', { error });
      throw error;
    }
  }

  async writePrice(data: PriceData): Promise<void> {
    try {
      const point = new Point(MEASUREMENT_PRICE)
        .floatField('price_per_m3', data.pricePerM3)
        .tag('currency', data.currency)
        .timestamp(data.timestamp);

      this.writeApi.writePoint(point);
      await this.writeApi.flush();

      this.logger.info(`Wrote price to InfluxDB: ${data.pricePerM3} ${data.currency}/m³`);
    } catch (error) {
      this.logger.error('Failed to write price to InfluxDB', { error });
      throw error;
    }
  }

  private parseDate(dateString: string): Date | undefined {
    const parts = dateString.split('.');
    if (parts.length !== 3) {
      return undefined;
    }

    const [day, month, year] = parts.map((p) => Number.parseInt(p, 10));
    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
      return undefined;
    }

    const date = new Date(
      `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    );
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }

    return date;
  }

  private parseDecimalValue(value: string): number {
    return Number.parseFloat(value.replace(',', '.'));
  }
}
