import winston from 'winston';
import dotenv from 'dotenv';
import { HoforScraper } from './scraper.js';
import { MqttClient } from './mqtt.js';
import { AddonConfig } from './types.js';

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
    mqtt: {
      broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clientId: process.env.MQTT_CLIENT_ID || 'hofor-scraper',
      baseTopic: process.env.MQTT_BASE_TOPIC || 'hofor',
    },
    scrapeIntervalHours: parseInt(process.env.SCRAPE_INTERVAL_HOURS || '3', 10),
    headless: process.env.HEADLESS !== 'false',
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  };

  // Validate required configuration
  if (!config.hofor.username || !config.hofor.password) {
    throw new Error('HOFOR credentials not configured. Set HOFOR_USERNAME and HOFOR_PASSWORD');
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
  private mqttClient: MqttClient;
  private logger: winston.Logger;
  private config: AddonConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isShuttingDown: boolean = false;

  constructor() {
    // Load configuration
    this.config = loadConfig();

    // Create logger
    this.logger = createLogger(this.config.logLevel);

    // Create scraper and MQTT client
    this.scraper = new HoforScraper(this.config.hofor, this.logger, this.config.headless);
    this.mqttClient = new MqttClient(this.config.mqtt, this.logger);

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

      // Publish to MQTT
      if (!this.mqttClient.isConnected()) {
        this.logger.warn('MQTT client not connected, attempting to reconnect...');
        await this.mqttClient.connect();
        await this.mqttClient.setupAutoDiscovery();
      }

      await this.mqttClient.publishAll(result.consumption, result.price);
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

    try {
      // Connect to MQTT broker
      await this.mqttClient.connect();

      // Setup Home Assistant auto-discovery
      await this.mqttClient.setupAutoDiscovery();

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
    try {
      await this.mqttClient.disconnect();
    } catch (error) {
      this.logger.error('Error disconnecting from MQTT', { error });
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
