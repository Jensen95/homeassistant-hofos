import { Logger } from 'winston';
import { MqttConfig, ConsumptionData, PriceData } from './types.js';
export declare class MqttClient {
    private readonly config;
    private readonly logger;
    private client;
    private connected;
    constructor(config: MqttConfig, logger: Logger);
    /**
     * Connect to MQTT broker
     */
    connect(): Promise<void>;
    /**
     * Disconnect from MQTT broker
     */
    disconnect(): Promise<void>;
    /**
     * Check if client is connected
     */
    isConnected(): boolean;
    /**
     * Publish Home Assistant auto-discovery configuration for consumption sensor
     */
    private publishConsumptionDiscovery;
    /**
     * Publish Home Assistant auto-discovery configuration for price sensor
     */
    private publishPriceDiscovery;
    /**
     * Setup Home Assistant auto-discovery for all sensors
     */
    setupAutoDiscovery(): Promise<void>;
    /**
     * Publish consumption data
     */
    publishConsumption(data: ConsumptionData): Promise<void>;
    /**
     * Publish price data
     */
    publishPrice(data: PriceData): Promise<void>;
    /**
     * Generic publish method
     */
    private publish;
    /**
     * Publish both consumption and price data
     */
    publishAll(consumption: ConsumptionData | null, price: PriceData | null): Promise<void>;
}
//# sourceMappingURL=mqtt.d.ts.map