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
