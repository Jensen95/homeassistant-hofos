export interface ConsumptionData {
  readingDate?: Date;
  timestamp: Date;
  unit: 'm³';
  value: number;
}

export interface HistoricalDataPoint {
  date: string;
  metric: string;
  usage: string;
}

export interface InfluxDBConfig {
  bucket: string;
  org: string;
  token: string;
  url: string;
}

export interface PriceData {
  currency: string;
  pricePerM3: number;
  timestamp: Date;
}
