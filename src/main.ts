import winston from 'winston';
import dotenv from 'dotenv';
import { InfluxDBClient } from './influxdb.js';
import { AddonConfig } from './types.js';
import { fetchHoforData } from './playwright.js';

dotenv.config();

function loadConfig(): AddonConfig {
  const config: AddonConfig = {
    hofor: {
      kundenummer: process.env.HOFOR_KUNDENUMMER || '',
      bsKundenummer: process.env.HOFOR_BS_KUNDENUMMER || '',
    },
    influxdb: {
      url: process.env.INFLUXDB_URL || 'http://a0d7b954-influxdb:8086',
      token: process.env.INFLUXDB_TOKEN || '',
      org: process.env.INFLUXDB_ORG || 'homeassistant',
      bucket: process.env.INFLUXDB_BUCKET || 'homeassistant/autogen',
    },
    scrapeIntervalHours: parseInt(process.env.SCRAPE_INTERVAL_HOURS || '3', 10),
    headless: process.env.HEADLESS !== 'false',
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    enableBackfill: process.env.ENABLE_BACKFILL === 'true',
    backfillDays: parseInt(process.env.BACKFILL_DAYS || '365', 10),
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

function createLogger(level: string): winston.Logger {
  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'hofor-scraper' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} [${level}]: ${message} ${metaStr}`;
          })
        ),
      }),
    ],
  });
}

class HoforScraperApp {
  private influxdbClient: InfluxDBClient;
  private logger: winston.Logger;
  private config: AddonConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor() {
    this.config = loadConfig();
    this.logger = createLogger(this.config.logLevel);
    this.influxdbClient = new InfluxDBClient(this.config.influxdb, this.logger);
    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, shutting down gracefully...`);
        await this.shutdown();
        process.exit(0);
      });
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error });
      this.shutdown().then(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { reason, promise });
    });
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
        startDate,
        endDate,
        kundenummer: this.config.hofor.kundenummer,
        bsKundenummer: this.config.hofor.bsKundenummer,
        headless: this.config.headless,
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
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        kundenummer: this.config.hofor.kundenummer,
        bsKundenummer: this.config.hofor.bsKundenummer,
        headless: this.config.headless,
      });

      if (historicalData.length > 0) {
        const latestPoint = historicalData[historicalData.length - 1];
        const usage = parseFloat(latestPoint.usage.replace(',', '.'));
        
        if (!isNaN(usage)) {
          const [day, month, year] = latestPoint.date.split('.');
          const readingDate = new Date(`${year}-${month}-${day}`);
          
          const consumption = {
            value: usage,
            timestamp: new Date(),
            unit: 'm³' as const,
            readingDate,
          };
          
          await this.influxdbClient.writeAll(consumption, null);
          this.logger.info('Scrape cycle completed successfully');
        } else {
          this.logger.warn('Latest data point has invalid usage value');
        }
      } else {
        this.logger.warn('No data returned from scrape');
      }
    } catch (error) {
      this.logger.error('Error during scrape cycle', { error });
    }
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
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    try {
      await this.influxdbClient.close();
    } catch (error) {
      this.logger.error('Error closing InfluxDB client', { error });
    }

    this.logger.info('Shutdown complete');
  }
}

async function main() {
  const app = new HoforScraperApp();
  await app.start();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
