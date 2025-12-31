import dotenv from 'dotenv';
import winston from 'winston';

import type { AddonConfig } from './types.js';

import { fetchHoforData } from './fetchHoforData.js';
import { InfluxDBClient } from './influxdb.js';

dotenv.config();

class HoforScraperApp {
  private config: AddonConfig;
  private influxdbClient: InfluxDBClient;
  private intervalId: NodeJS.Timeout | undefined = undefined;
  private isShuttingDown: boolean = false;
  private logger: winston.Logger;

  constructor() {
    this.config = loadConfig();
    this.logger = createLogger(this.config.logLevel);
    this.influxdbClient = new InfluxDBClient(this.config.influxdb, this.logger);
    this.setupSignalHandlers();
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    try {
      await this.influxdbClient.close();
    } catch (error) {
      this.logger.error('Error closing InfluxDB client', { error });
    }

    this.logger.info('Shutdown complete');
  }

  async start(): Promise<void> {
    this.logger.info('Starting HOFOR Scraper Addon...');
    this.logger.info(`Configuration: scrape interval = ${this.config.scrapeIntervalHours} hours`);

    try {
      if (this.config.enableBackfill) {
        await this.backfillHistoricalData();
      }

      await this.scrapeAndPublish();

      const intervalMs = this.config.scrapeIntervalHours * 60 * 60 * 1000;
      this.intervalId = setInterval(() => {
        this.scrapeAndPublish().catch((error) => {
          this.logger.error('Error in scheduled scrape', { error });
        });
      }, intervalMs);

      this.logger.info(`Scraper started. Next scrape in ${this.config.scrapeIntervalHours} hours`);
    } catch (error) {
      this.logger.error('Failed to start application', { error });
      await this.shutdown();
      throw new Error('Failed to start application');
    }
  }

  private async backfillHistoricalData(): Promise<void> {
    if (!this.config.enableBackfill) {
      this.logger.info('Backfilling is disabled');
      return;
    }

    this.logger.info(`Starting backfill for last ${this.config.backfillDays} days...`);

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - this.config.backfillDays);
      const endDate = new Date();

      const historicalData = await fetchHoforData({
        bsKundenummer: this.config.hofor.bsKundenummer,
        endDate,
        headless: this.config.headless,
        kundenummer: this.config.hofor.kundenummer,
        startDate,
      });

      if (historicalData.length > 0) {
        await this.influxdbClient.writeHistoricalData(historicalData);
        this.logger.info(`Backfill completed: ${historicalData.length} data points`);
      } else {
        this.logger.warn('No historical data found to backfill');
      }
    } catch (error) {
      this.logger.error('Failed to backfill historical data', { error });
    }
  }

  private async scrapeAndPublish(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.logger.info('Starting scrape cycle...');

    try {
      const historicalData = await fetchHoforData({
        bsKundenummer: this.config.hofor.bsKundenummer,
        endDate: new Date(),
        headless: this.config.headless,
        kundenummer: this.config.hofor.kundenummer,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      if (historicalData.length > 0) {
        const latestPoint = historicalData.at(-1)!;
        const usage = Number.parseFloat(latestPoint.usage.replace(',', '.'));

        if (Number.isNaN(usage)) {
          this.logger.warn('Latest data point has invalid usage value');
        } else {
          const [day, month, year] = latestPoint.date.split('.');
          const readingDate = new Date(`${year}-${month}-${day}`);

          const consumption = {
            readingDate,
            timestamp: new Date(),
            unit: 'm³' as const,
            value: usage,
          };

          const price =
            this.config.waterPrice.pricePerM3 > 0
              ? {
                  currency: this.config.waterPrice.currency,
                  pricePerM3: this.config.waterPrice.pricePerM3,
                  timestamp: new Date(),
                }
              : null;

          await this.influxdbClient.writeAll(consumption, price);
        }
      }
    } catch (error) {
      this.logger.error('Error during scrape cycle', { error });
    }
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    for (const signal of signals) {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, shutting down gracefully...`);
        await this.shutdown();
      });
    }

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      this.shutdown().then(() => {
        throw error;
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { promise, reason });
    });
  }
}

function createLogger(level: string): winston.Logger {
  return winston.createLogger({
    defaultMeta: { service: 'hofor-scraper' },
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    level,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, ...meta }) => {
            const metaString =
              Object.keys(meta).length > 0 ? JSON.stringify(meta, undefined, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaString}`;
          })
        ),
      }),
    ],
  });
}

function loadConfig(): AddonConfig {
  const config: AddonConfig = {
    backfillDays: Number.parseInt(process.env.BACKFILL_DAYS || '365', 10),
    enableBackfill: process.env.ENABLE_BACKFILL === 'true',
    headless: process.env.HEADLESS !== 'false',
    hofor: {
      bsKundenummer: process.env.HOFOR_BS_KUNDENUMMER || '',
      kundenummer: process.env.HOFOR_KUNDENUMMER || '',
    },
    influxdb: {
      bucket: process.env.INFLUXDB_BUCKET || 'homeassistant/autogen',
      org: process.env.INFLUXDB_ORG || 'homeassistant',
      token: process.env.INFLUXDB_TOKEN || '',
      url: process.env.INFLUXDB_URL || 'http://a0d7b954-influxdb:8086',
    },
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'error' | 'info' | 'warn') || 'info',
    scrapeIntervalHours: Number.parseInt(process.env.SCRAPE_INTERVAL_HOURS || '3', 10),
    waterPrice: {
      currency: process.env.WATER_PRICE_CURRENCY || 'DKK',
      pricePerM3: Number.parseFloat(process.env.WATER_PRICE_PER_M3 || '0'),
    },
  };

  if (!config.hofor.kundenummer || !config.hofor.bsKundenummer) {
    throw new Error(
      'HOFOR credentials not configured. Set HOFOR_KUNDENUMMER and HOFOR_BS_KUNDENUMMER'
    );
  }

  if (!config.influxdb.token) {
    throw new Error('InfluxDB token not configured. Set INFLUXDB_TOKEN');
  }

  return config;
}

const app = new HoforScraperApp();
try {
  await app.start();
} catch (error) {
  console.error('Fatal error:', error);
  throw error;
}
