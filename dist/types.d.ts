/**
 * Type definitions for HOFOR Scraper Addon
 */
/**
 * Consumption data from HOFOR
 */
export interface ConsumptionData {
    /** Consumption reading in cubic meters */
    value: number;
    /** Timestamp of the reading */
    timestamp: Date;
    /** Unit of measurement */
    unit: 'm³';
    /** Optional reading date if different from timestamp */
    readingDate?: Date;
}
/**
 * Historical consumption data point
 */
export interface HistoricalDataPoint {
    /** Date of the measurement */
    date: string;
    /** Usage value */
    usage: string;
    /** Metric type */
    metric: string;
}
/**
 * Price data per cubic meter
 */
export interface PriceData {
    /** Price per cubic meter */
    pricePerM3: number;
    /** Currency code (e.g., 'DKK') */
    currency: string;
    /** Timestamp when price was retrieved */
    timestamp: Date;
}
/**
 * MQTT configuration
 */
export interface MqttConfig {
    /** MQTT broker URL */
    broker: string;
    /** MQTT username (optional) */
    username?: string;
    /** MQTT password (optional) */
    password?: string;
    /** MQTT client ID */
    clientId: string;
    /** Base topic for publishing */
    baseTopic?: string;
}
/**
 * InfluxDB configuration
 */
export interface InfluxDBConfig {
    /** InfluxDB URL */
    url: string;
    /** InfluxDB authentication token */
    token: string;
    /** InfluxDB organization */
    org: string;
    /** InfluxDB bucket */
    bucket: string;
}
/**
 * HOFOR credentials
 */
export interface HoforCredentials {
    /** HOFOR username */
    username: string;
    /** HOFOR password */
    password: string;
}
/**
 * Addon configuration
 */
export interface AddonConfig {
    /** HOFOR credentials */
    hofor: HoforCredentials;
    /** MQTT configuration (optional) */
    mqtt?: MqttConfig;
    /** InfluxDB configuration (optional) */
    influxdb?: InfluxDBConfig;
    /** Scraping interval in hours */
    scrapeIntervalHours: number;
    /** Run browser in headless mode */
    headless: boolean;
    /** Log level */
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    /** Enable backfilling of historical data */
    enableBackfill: boolean;
    /** Number of days to backfill */
    backfillDays: number;
}
/**
 * Home Assistant MQTT discovery configuration
 */
export interface HADiscoveryConfig {
    /** Device name */
    name: string;
    /** Unique ID */
    unique_id: string;
    /** State topic */
    state_topic: string;
    /** Unit of measurement */
    unit_of_measurement?: string;
    /** Device class */
    device_class?: string;
    /** State class */
    state_class?: 'measurement' | 'total' | 'total_increasing';
    /** Icon */
    icon?: string;
    /** Device information */
    device?: {
        identifiers: string[];
        name: string;
        manufacturer: string;
        model: string;
    };
}
/**
 * Scraper result containing both consumption and price data
 */
export interface ScraperResult {
    /** Consumption data */
    consumption: ConsumptionData | null;
    /** Price data */
    price: PriceData | null;
    /** Scraping success status */
    success: boolean;
    /** Error message if scraping failed */
    error?: string;
}
/**
 * Custom error class for scraper errors
 */
export declare class ScraperError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    constructor(message: string, code: string, retryable?: boolean);
}
/**
 * Custom error class for MQTT errors
 */
export declare class MqttError extends Error {
    readonly code: string;
    readonly retryable: boolean;
    constructor(message: string, code: string, retryable?: boolean);
}
//# sourceMappingURL=types.d.ts.map