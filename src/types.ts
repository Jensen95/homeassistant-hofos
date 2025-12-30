import type { InfluxDBConfig } from './influxdb.types.js';

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
