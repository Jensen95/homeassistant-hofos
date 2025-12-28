import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MqttClient } from './mqtt.js';
import { Logger } from 'winston';
import { ConsumptionData, PriceData } from './types.js';

// Mock mqtt
vi.mock('mqtt', () => ({
  default: {
    connect: vi.fn().mockReturnValue({
      on: vi.fn((event, callback) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      }),
      publish: vi.fn((topic, payload, options, callback) => {
        if (callback) callback(null);
      }),
      endAsync: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

describe('MqttClient', () => {
  let mockLogger: Logger;
  let mqttClient: MqttClient;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;

    mqttClient = new MqttClient(
      {
        broker: 'mqtt://localhost:1883',
        clientId: 'test-client',
        baseTopic: 'hofor',
      },
      mockLogger
    );
  });

  afterEach(async () => {
    await mqttClient.disconnect();
  });

  describe('connect', () => {
    it('should connect to MQTT broker successfully', async () => {
      await mqttClient.connect();
      expect(mqttClient.isConnected()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Connected to MQTT'));
    });
  });

  describe('setupAutoDiscovery', () => {
    it('should publish Home Assistant discovery configs', async () => {
      await mqttClient.connect();
      await mqttClient.setupAutoDiscovery();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Auto-discovery setup complete')
      );
    });
  });

  describe('publishConsumption', () => {
    it('should publish consumption data', async () => {
      await mqttClient.connect();

      const consumption: ConsumptionData = {
        value: 123.45,
        timestamp: new Date(),
        unit: 'm³',
      };

      await mqttClient.publishConsumption(consumption);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Published consumption')
      );
    });
  });

  describe('publishPrice', () => {
    it('should publish price data', async () => {
      await mqttClient.connect();

      const price: PriceData = {
        pricePerM3: 5.67,
        currency: 'DKK',
        timestamp: new Date(),
      };

      await mqttClient.publishPrice(price);

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Published price'));
    });
  });

  describe('publishAll', () => {
    it('should publish both consumption and price', async () => {
      await mqttClient.connect();

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

      await mqttClient.publishAll(consumption, price);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Published consumption')
      );
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Published price'));
    });

    it('should handle null values gracefully', async () => {
      await mqttClient.connect();

      await mqttClient.publishAll(null, null);

      expect(mockLogger.warn).toHaveBeenCalledWith('No consumption data to publish');
      expect(mockLogger.warn).toHaveBeenCalledWith('No price data to publish');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from MQTT broker', async () => {
      await mqttClient.connect();
      await mqttClient.disconnect();

      expect(mqttClient.isConnected()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Disconnected from MQTT')
      );
    });
  });
});
