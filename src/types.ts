export interface ConsumptionData {
  value: number;
  timestamp: Date;
  unit: 'm³';
  readingDate?: Date;
}

export interface HistoricalDataPoint {
  date: string;
  usage: string;
  metric: string;
}

export interface PriceData {
  pricePerM3: number;
  currency: string;
  timestamp: Date;
}

export interface InfluxDBConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
}

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
