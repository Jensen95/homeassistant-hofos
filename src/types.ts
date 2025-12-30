import { InfluxDBConfig, ConsumptionData, PriceData } from './influxdb.types.js';

export interface HoforCredentials {
  kundenummer: string;
  bsKundenummer: string;
}

export interface AddonConfig {
  hofor: HoforCredentials;
  influxdb: InfluxDBConfig;
  scrapeIntervalHours: number;
  headless: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableBackfill: boolean;
  backfillDays: number;
}

export interface ScraperResult {
  consumption: ConsumptionData | null;
  price: PriceData | null;
  success: boolean;
  error?: string;
}

export class ScraperError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}
