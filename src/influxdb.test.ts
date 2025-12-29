import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InfluxDBClient } from './influxdb.js';
import { Logger } from 'winston';
import { ConsumptionData, PriceData, HistoricalDataPoint } from './types.js';

// Mock @influxdata/influxdb-client
const mockWriteApi = {
  useDefaultTags: vi.fn(),
  writePoint: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@influxdata/influxdb-client', () => ({
  InfluxDB: class {
    constructor() {}
    getWriteApi() {
      return mockWriteApi;
    }
  },
  Point: class {
    floatField() {
      return this;
    }
    tag() {
      return this;
    }
    timestamp() {
      return this;
    }
  },
}));

describe('InfluxDBClient', () => {
  let mockLogger: Logger;
  let influxdbClient: InfluxDBClient;

  beforeEach(() => {
    vi.clearAllMocks();
    
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
    it('should write consumption data to InfluxDB', async () => {
      const consumption: ConsumptionData = {
        value: 123.45,
        timestamp: new Date(),
        unit: 'm³',
      };

      await influxdbClient.writeConsumption(consumption);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wrote consumption to InfluxDB')
      );
    });
  });

  describe('writePrice', () => {
    it('should write price data to InfluxDB', async () => {
      const price: PriceData = {
        pricePerM3: 5.67,
        currency: 'DKK',
        timestamp: new Date(),
      };

      await influxdbClient.writePrice(price);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wrote price to InfluxDB')
      );
    });
  });

  describe('writeHistoricalData', () => {
    it('should write historical data points to InfluxDB', async () => {
      const historicalData: HistoricalDataPoint[] = [
        { date: '01.01.2024', usage: '10.5', metric: 'm³' },
        { date: '02.01.2024', usage: '12.3', metric: 'm³' },
      ];

      await influxdbClient.writeHistoricalData(historicalData);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wrote 2 historical data points to InfluxDB')
      );
    });

    it('should skip invalid usage values', async () => {
      const historicalData: HistoricalDataPoint[] = [
        { date: '01.01.2024', usage: 'invalid', metric: 'm³' },
        { date: '02.01.2024', usage: '12.3', metric: 'm³' },
      ];

      await influxdbClient.writeHistoricalData(historicalData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping invalid usage value')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wrote 1 historical data points to InfluxDB')
      );
    });

    it('should skip invalid dates', async () => {
      const historicalData: HistoricalDataPoint[] = [
        { date: 'invalid', usage: '10.5', metric: 'm³' },
        { date: '02.01.2024', usage: '12.3', metric: 'm³' },
      ];

      await influxdbClient.writeHistoricalData(historicalData);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping invalid date')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wrote 1 historical data points to InfluxDB')
      );
    });
  });

  describe('writeAll', () => {
    it('should write both consumption and price', async () => {
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

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wrote consumption to InfluxDB')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Wrote price to InfluxDB')
      );
    });

    it('should handle null values gracefully', async () => {
      await influxdbClient.writeAll(null, null);

      expect(mockLogger.warn).toHaveBeenCalledWith('No consumption data to write');
      expect(mockLogger.warn).toHaveBeenCalledWith('No price data to write');
    });
  });

  describe('close', () => {
    it('should close InfluxDB client', async () => {
      await influxdbClient.close();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('InfluxDB client closed')
      );
    });
  });
});
