import mqtt from 'mqtt';
import { Logger } from 'winston';
import { MqttConfig, ConsumptionData, PriceData, HADiscoveryConfig, MqttError } from './types.js';

const HA_DISCOVERY_PREFIX = 'homeassistant';
const DEVICE_NAME = 'HOFOR';
const DEVICE_MANUFACTURER = 'HOFOR';
const DEVICE_MODEL = 'Water Consumption Monitor';

export class MqttClient {
  private client: mqtt.MqttClient | null = null;
  private connected: boolean = false;

  constructor(
    private readonly config: MqttConfig,
    private readonly logger: Logger
  ) {}

  /**
   * Connect to MQTT broker
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.logger.info(`Connecting to MQTT broker: ${this.config.broker}`);

      const options: mqtt.IClientOptions = {
        clientId: this.config.clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      };

      if (this.config.username && this.config.password) {
        options.username = this.config.username;
        options.password = this.config.password;
      }

      this.client = mqtt.connect(this.config.broker, options);

      this.client.on('connect', () => {
        this.connected = true;
        this.logger.info('Connected to MQTT broker');
        resolve();
      });

      this.client.on('error', (error) => {
        this.logger.error('MQTT connection error', { error });
        reject(new MqttError('Failed to connect to MQTT broker', 'CONNECTION_FAILED', true));
      });

      this.client.on('offline', () => {
        this.connected = false;
        this.logger.warn('MQTT client offline');
      });

      this.client.on('reconnect', () => {
        this.logger.info('Reconnecting to MQTT broker...');
      });
    });
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.endAsync();
      this.client = null;
      this.connected = false;
      this.logger.info('Disconnected from MQTT broker');
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  /**
   * Publish Home Assistant auto-discovery configuration for consumption sensor
   */
  private async publishConsumptionDiscovery(): Promise<void> {
    const uniqueId = 'hofor_consumption';
    const stateTopic = `${this.config.baseTopic || 'hofor'}/consumption/state`;
    const configTopic = `${HA_DISCOVERY_PREFIX}/sensor/${uniqueId}/config`;

    const config: HADiscoveryConfig = {
      name: 'HOFOR Water Consumption',
      unique_id: uniqueId,
      state_topic: stateTopic,
      unit_of_measurement: 'm³',
      device_class: 'water',
      state_class: 'total_increasing',
      icon: 'mdi:water',
      device: {
        identifiers: ['hofor_scraper'],
        name: DEVICE_NAME,
        manufacturer: DEVICE_MANUFACTURER,
        model: DEVICE_MODEL,
      },
    };

    await this.publish(configTopic, JSON.stringify(config), true);
    this.logger.debug('Published consumption sensor discovery config');
  }

  /**
   * Publish Home Assistant auto-discovery configuration for price sensor
   */
  private async publishPriceDiscovery(): Promise<void> {
    const uniqueId = 'hofor_price_per_m3';
    const stateTopic = `${this.config.baseTopic || 'hofor'}/price/state`;
    const configTopic = `${HA_DISCOVERY_PREFIX}/sensor/${uniqueId}/config`;

    const config: HADiscoveryConfig = {
      name: 'HOFOR Price per m³',
      unique_id: uniqueId,
      state_topic: stateTopic,
      unit_of_measurement: 'DKK/m³',
      icon: 'mdi:currency-usd',
      device: {
        identifiers: ['hofor_scraper'],
        name: DEVICE_NAME,
        manufacturer: DEVICE_MANUFACTURER,
        model: DEVICE_MODEL,
      },
    };

    await this.publish(configTopic, JSON.stringify(config), true);
    this.logger.debug('Published price sensor discovery config');
  }

  /**
   * Setup Home Assistant auto-discovery for all sensors
   */
  async setupAutoDiscovery(): Promise<void> {
    if (!this.isConnected()) {
      throw new MqttError('MQTT client not connected', 'NOT_CONNECTED');
    }

    this.logger.info('Setting up Home Assistant auto-discovery...');
    await this.publishConsumptionDiscovery();
    await this.publishPriceDiscovery();
    this.logger.info('Auto-discovery setup complete');
  }

  /**
   * Publish consumption data
   */
  async publishConsumption(data: ConsumptionData): Promise<void> {
    if (!this.isConnected()) {
      throw new MqttError('MQTT client not connected', 'NOT_CONNECTED');
    }

    const stateTopic = `${this.config.baseTopic || 'hofor'}/consumption/state`;
    const payload = data.value.toString();

    await this.publish(stateTopic, payload, false);
    this.logger.info(`Published consumption: ${data.value} ${data.unit}`);
  }

  /**
   * Publish price data
   */
  async publishPrice(data: PriceData): Promise<void> {
    if (!this.isConnected()) {
      throw new MqttError('MQTT client not connected', 'NOT_CONNECTED');
    }

    const stateTopic = `${this.config.baseTopic || 'hofor'}/price/state`;
    const payload = data.pricePerM3.toString();

    await this.publish(stateTopic, payload, false);
    this.logger.info(`Published price: ${data.pricePerM3} ${data.currency}/m³`);
  }

  /**
   * Generic publish method
   */
  private async publish(topic: string, payload: string, retain: boolean): Promise<void> {
    if (!this.client) {
      throw new MqttError('MQTT client not initialized', 'NOT_INITIALIZED');
    }

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, payload, { qos: 1, retain }, (error) => {
        if (error) {
          this.logger.error('Failed to publish message', { topic, error });
          reject(new MqttError('Failed to publish message', 'PUBLISH_FAILED', true));
        } else {
          this.logger.debug(`Published to ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Publish both consumption and price data
   */
  async publishAll(consumption: ConsumptionData | null, price: PriceData | null): Promise<void> {
    const errors: string[] = [];

    if (consumption) {
      try {
        await this.publishConsumption(consumption);
      } catch (error) {
        const msg = `Failed to publish consumption: ${(error as Error).message}`;
        this.logger.error(msg);
        errors.push(msg);
      }
    } else {
      this.logger.warn('No consumption data to publish');
    }

    if (price) {
      try {
        await this.publishPrice(price);
      } catch (error) {
        const msg = `Failed to publish price: ${(error as Error).message}`;
        this.logger.error(msg);
        errors.push(msg);
      }
    } else {
      this.logger.warn('No price data to publish');
    }

    if (errors.length > 0) {
      throw new MqttError(`Publishing errors: ${errors.join(', ')}`, 'PARTIAL_FAILURE');
    }
  }
}
