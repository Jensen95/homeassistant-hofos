import winston from 'winston';
import dotenv from 'dotenv';
import { HoforScraper } from './scraper.js';
import { MqttClient } from './mqtt.js';
import { InfluxDBClient } from './influxdb.js';
import { AddonConfig } from './types.js';
import { fetchHoforData } from './playwright.js';

// Load environment variables
dotenv.config();

/**
 * Load configuration from environment variables
 */
function loadConfig(): AddonConfig {
  const config: AddonConfig = {
    hofor: {
      username: process.env.HOFOR_KUNDENUMMER || '',
      password: process.env.HOFOR_BS_KUNDENUMMER || '',
    },
    scrapeIntervalHours: parseInt(process.env.SCRAPE_INTERVAL_HOURS || '3', 10),
    headless: process.env.HEADLESS !== 'false',
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    enableBackfill: process.env.ENABLE_BACKFILL === 'true',
    backfillDays: parseInt(process.env.BACKFILL_DAYS || '365', 10),
  };

  // Configure MQTT if provided
  if (process.env.MQTT_BROKER) {
    config.mqtt = {
      broker: process.env.MQTT_BROKER,
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID || 'hofor-scraper',
      baseTopic: process.env.MQTT_BASE_TOPIC || 'hofor',
    };
  }

  // Configure InfluxDB if provided
  if (process.env.INFLUXDB_URL && process.env.INFLUXDB_TOKEN && process.env.INFLUXDB_ORG) {
    config.influxdb = {
      url: process.env.INFLUXDB_URL,
      token: process.env.INFLUXDB_TOKEN,
      org: process.env.INFLUXDB_ORG,
      bucket: process.env.INFLUXDB_BUCKET || 'hofor',
    };
  }

  // Validate required configuration
  if (!config.hofor.username || !config.hofor.password) {
    throw new Error('HOFOR credentials not configured. Set HOFOR_KUNDENUMMER and HOFOR_BS_KUNDENUMMER');
  }

  if (!config.mqtt && !config.influxdb) {
    throw new Error('Either MQTT or InfluxDB must be configured');
  }

  return config;
}

/**
 * Create Winston logger
 */
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

/**
 * Main application class
 */
class HoforScraperApp {
  private scraper: HoforScraper;
  private mqttClient?: MqttClient;
  private influxdbClient?: InfluxDBClient;
  private logger: winston.Logger;
  private config: AddonConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor() {
    // Load configuration
    this.config = loadConfig();

    // Create logger
    this.logger = createLogger(this.config.logLevel);

    // Create scraper
    this.scraper = new HoforScraper(this.config.hofor, this.logger, this.config.headless);

    // Create MQTT client if configured
    if (this.config.mqtt) {
      this.mqttClient = new MqttClient(this.config.mqtt, this.logger);
    }

    // Create InfluxDB client if configured
    if (this.config.influxdb) {
      this.influxdbClient = new InfluxDBClient(this.config.influxdb, this.logger);
    }

    // Setup signal handlers for graceful shutdown
    this.setupSignalHandlers();
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
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

  /**
   * Perform backfilling of historical data
   */
  private async backfillHistoricalData(): Promise<void> {
    if (!this.config.enableBackfill) {
      this.logger.info('Backfilling is disabled');
      return;
    }

    if (!this.influxdbClient) {
      this.logger.warn('Backfilling requires InfluxDB to be configured');
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
        kundenummer: this.config.hofor.username,
        bsKundenummer: this.config.hofor.password,
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

  /**
   * Perform a single scrape and publish cycle
   */
  private async scrapeAndPublish(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.logger.info('Starting scrape cycle...');

    try {
      // Scrape HOFOR data
      const result = await this.scraper.scrape();

      if (!result.success) {
        this.logger.error(`Scraping failed: ${result.error}`);
        return;
      }

      // Publish to MQTT if configured
      if (this.mqttClient) {
        if (!this.mqttClient.isConnected()) {
          this.logger.warn('MQTT client not connected, attempting to reconnect...');
          await this.mqttClient.connect();
          await this.mqttClient.setupAutoDiscovery();
        }
        await this.mqttClient.publishAll(result.consumption, result.price);
      }

      // Write to InfluxDB if configured
      if (this.influxdbClient) {
        await this.influxdbClient.writeAll(result.consumption, result.price);
      }

      this.logger.info('Scrape cycle completed successfully');
    } catch (error) {
      this.logger.error('Error during scrape cycle', { error });
    }
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    this.logger.info('Starting HOFOR Scraper Addon...');
    this.logger.info(`Configuration: scrape interval = ${this.config.scrapeIntervalHours} hours`);
    this.logger.info(`Data storage: MQTT=${!!this.config.mqtt}, InfluxDB=${!!this.config.influxdb}`);

    try {
      // Connect to MQTT broker if configured
      if (this.mqttClient) {
        await this.mqttClient.connect();
        await this.mqttClient.setupAutoDiscovery();
      }

      // Perform backfilling if enabled
      if (this.config.enableBackfill && this.influxdbClient) {
        await this.backfillHistoricalData();
      }

      // Perform initial scrape
      await this.scrapeAndPublish();

      // Schedule periodic scraping
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

  /**
   * Shutdown the application gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.info('Shutting down...');

    // Stop scheduled scraping
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Close scraper (browser)
    try {
      await this.scraper.close();
    } catch (error) {
      this.logger.error('Error closing scraper', { error });
    }

    // Disconnect from MQTT
    if (this.mqttClient) {
      try {
        await this.mqttClient.disconnect();
      } catch (error) {
        this.logger.error('Error disconnecting from MQTT', { error });
      }
    }

    // Close InfluxDB client
    if (this.influxdbClient) {
      try {
        await this.influxdbClient.close();
      } catch (error) {
        this.logger.error('Error closing InfluxDB client', { error });
      }
    }

    this.logger.info('Shutdown complete');
  }
}

/**
 * Main entry point
 */
async function main() {
  const app = new HoforScraperApp();
  await app.start();
}

// Start the application
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
