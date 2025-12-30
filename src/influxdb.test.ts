import { Point } from '@influxdata/influxdb-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from 'winston';

import type { ConsumptionData, HistoricalDataPoint, PriceData } from './influxdb.types.js';

import { InfluxDBClient } from './influxdb.js';

const mockWriteApi = {
  useDefaultTags: vi.fn(),
  writePoint: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

const mockPoints: (Point & {
  getMeasurement(): string;
  getField(name: string): number | undefined;
  getTag(name: string): string | undefined;
  getTimestamp(): Date | undefined;
})[] = [];

vi.mock('@influxdata/influxdb-client', () => ({
  InfluxDB: class {
    constructor() {}
    getWriteApi() {
      return mockWriteApi;
    }
  },
  Point: class MockPoint {
    private fields: Map<string, number> = new Map();
    private tags: Map<string, string> = new Map();
    private _timestamp?: Date;
    private _measurement: string;

    constructor(measurement: string) {
      this._measurement = measurement;
      mockPoints.push(this as any);
    }

    floatField(name: string, value: number) {
      this.fields.set(name, value);
      return this;
    }

    tag(name: string, value: string) {
      this.tags.set(name, value);
      return this;
    }

    timestamp(value: Date) {
      this._timestamp = value;
      return this;
    }

    getMeasurement() {
      return this._measurement;
    }

    getField(name: string) {
      return this.fields.get(name);
    }

    getTag(name: string) {
      return this.tags.get(name);
    }

    getTimestamp() {
      return this._timestamp;
    }
  },
}));

describe('InfluxDBClient', () => {
  let mockLogger: Logger;
  let influxdbClient: InfluxDBClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPoints.length = 0;

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;

    influxdbClient = new InfluxDBClient(
      {
        url: 'http://localhost:8086',
        token: 'test-token',
        org: 'test-org',
        bucket: 'test-bucket',
      },
      mockLogger
    );
  });

  afterEach(async () => {
    if (influxdbClient) {
      await influxdbClient.close();
    }
  });

  describe('writeConsumption', () => {
    it('should write consumption data with correct measurement and fields', async () => {
      const consumption: ConsumptionData = {
        value: 123.45,
        timestamp: new Date('2024-01-15T10:00:00Z'),
        unit: 'm³',
      };

      await influxdbClient.writeConsumption(consumption);

      expect(mockPoints.length).toBe(1);
      const point = mockPoints[0] as any;
      expect(point.getMeasurement()).toBe('water_consumption');
      expect(point.getField('value')).toBe(123.45);
      expect(point.getTag('unit')).toBe('m³');
      expect(point.getTimestamp()).toEqual(consumption.timestamp);
      expect(mockWriteApi.writePoint).toHaveBeenCalledWith(point);
      expect(mockWriteApi.flush).toHaveBeenCalled();
    });

    it('should use readingDate when provided', async () => {
      const readingDate = new Date('2024-01-14T00:00:00Z');
      const consumption: ConsumptionData = {
        value: 50.0,
        timestamp: new Date('2024-01-15T10:00:00Z'),
        unit: 'm³',
        readingDate,
      };

      await influxdbClient.writeConsumption(consumption);

      expect(mockPoints.length).toBe(1);
      const point = mockPoints[0] as any;
      expect(point.getTimestamp()).toEqual(readingDate);
    });
  });

  describe('writePrice', () => {
    it('should write price data with correct measurement and fields', async () => {
      const price: PriceData = {
        pricePerM3: 5.67,
        currency: 'DKK',
        timestamp: new Date('2024-01-15T10:00:00Z'),
      };

      await influxdbClient.writePrice(price);

      expect(mockPoints.length).toBe(1);
      const point = mockPoints[0] as any;
      expect(point.getMeasurement()).toBe('water_price');
      expect(point.getField('price_per_m3')).toBe(5.67);
      expect(point.getTag('currency')).toBe('DKK');
      expect(point.getTimestamp()).toEqual(price.timestamp);
      expect(mockWriteApi.writePoint).toHaveBeenCalledWith(point);
      expect(mockWriteApi.flush).toHaveBeenCalled();
    });
  });

  describe('writeHistoricalData', () => {
    it('should parse and write historical data points with correct values', async () => {
      const historicalData: HistoricalDataPoint[] = [
        { date: '01.01.2024', usage: '10.5', metric: 'm³' },
        { date: '02.01.2024', usage: '12,3', metric: 'm³' },
      ];

      await influxdbClient.writeHistoricalData(historicalData);

      expect(mockPoints.length).toBe(2);

      const point1 = mockPoints[0] as any;
      expect(point1.getMeasurement()).toBe('water_consumption');
      expect(point1.getField('value')).toBe(10.5);
      expect(point1.getTag('unit')).toBe('m³');
      expect(point1.getTag('backfilled')).toBe('true');
      expect(point1.getTimestamp()).toEqual(new Date('2024-01-01T00:00:00Z'));

      const point2 = mockPoints[1] as any;
      expect(point2.getField('value')).toBe(12.3);
      expect(point2.getTimestamp()).toEqual(new Date('2024-01-02T00:00:00Z'));

      expect(mockWriteApi.flush).toHaveBeenCalled();
    });

    it('should skip invalid usage values and only write valid ones', async () => {
      const historicalData: HistoricalDataPoint[] = [
        { date: '01.01.2024', usage: 'invalid', metric: 'm³' },
        { date: '02.01.2024', usage: '12.3', metric: 'm³' },
        { date: '03.01.2024', usage: 'NaN', metric: 'm³' },
      ];

      await influxdbClient.writeHistoricalData(historicalData);

      expect(mockPoints.length).toBe(1);
      const point = mockPoints[0] as any;
      expect(point.getField('value')).toBe(12.3);
      expect(mockLogger.warn).toHaveBeenCalledWith('Skipping invalid usage value: invalid');
      expect(mockLogger.warn).toHaveBeenCalledWith('Skipping invalid usage value: NaN');
    });

    it('should skip invalid dates and only write valid ones', async () => {
      const historicalData: HistoricalDataPoint[] = [
        { date: 'invalid', usage: '10.5', metric: 'm³' },
        { date: '02.01.2024', usage: '12.3', metric: 'm³' },
        { date: '32.13.2024', usage: '15.0', metric: 'm³' },
      ];

      await influxdbClient.writeHistoricalData(historicalData);

      expect(mockPoints.length).toBe(1);
      const point = mockPoints[0] as any;
      expect(point.getField('value')).toBe(12.3);
      expect(point.getTimestamp()).toEqual(new Date('2024-01-02T00:00:00Z'));
      expect(mockLogger.warn).toHaveBeenCalledWith('Skipping invalid date: invalid');
      expect(mockLogger.warn).toHaveBeenCalledWith('Skipping invalid date: 32.13.2024');
    });

    it('should handle Danish decimal format with comma', async () => {
      const historicalData: HistoricalDataPoint[] = [
        { date: '15.03.2024', usage: '25,75', metric: 'm³' },
      ];

      await influxdbClient.writeHistoricalData(historicalData);

      expect(mockPoints.length).toBe(1);
      const point = mockPoints[0] as any;
      expect(point.getField('value')).toBe(25.75);
    });
  });

  describe('writeAll', () => {
    it('should write both consumption and price when provided', async () => {
      const consumption: ConsumptionData = {
        value: 123.45,
        timestamp: new Date(),
        unit: 'm³',
      };

      const price: PriceData = {
        pricePerM3: 5.67,
        currency: 'DKK',
        timestamp: new Date(),
      };

      await influxdbClient.writeAll(consumption, price);

      expect(mockPoints.length).toBe(2);
      expect(mockPoints[0].getMeasurement()).toBe('water_consumption');
      expect(mockPoints[1].getMeasurement()).toBe('water_price');
    });

    it('should handle null consumption gracefully', async () => {
      const price: PriceData = {
        pricePerM3: 5.67,
        currency: 'DKK',
        timestamp: new Date(),
      };

      await influxdbClient.writeAll(null, price);

      expect(mockPoints.length).toBe(1);
      expect(mockPoints[0].getMeasurement()).toBe('water_price');
      expect(mockLogger.warn).toHaveBeenCalledWith('No consumption data to write');
    });

    it('should handle null price gracefully', async () => {
      const consumption: ConsumptionData = {
        value: 123.45,
        timestamp: new Date(),
        unit: 'm³',
      };

      await influxdbClient.writeAll(consumption, null);

      expect(mockPoints.length).toBe(1);
      expect(mockPoints[0].getMeasurement()).toBe('water_consumption');
      expect(mockLogger.warn).toHaveBeenCalledWith('No price data to write');
    });
  });

  describe('close', () => {
    it('should close the write API', async () => {
      await influxdbClient.close();

      expect(mockWriteApi.close).toHaveBeenCalledOnce();
    });
  });
});
