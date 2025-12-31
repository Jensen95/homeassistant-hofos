import type { InfluxDBConfig } from './influxdb.types.js';

export interface AddonConfig {
  backfillDays: number;
  enableBackfill: boolean;
  headless: boolean;
  hofor: HoforCredentials;
  influxdb: InfluxDBConfig;
  logLevel: 'debug' | 'error' | 'info' | 'warn';
  scrapeIntervalHours: number;
  waterPrice: WaterPriceConfig;
}

export interface HoforCredentials {
  bsKundenummer: string;
  kundenummer: string;
}

export interface WaterPriceConfig {
  currency: string;
  pricePerM3: number;
}
