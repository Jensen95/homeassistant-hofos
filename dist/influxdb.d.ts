import { Logger } from 'winston';
import { InfluxDBConfig, ConsumptionData, PriceData, HistoricalDataPoint } from './types.js';
export declare class InfluxDBClient {
    private readonly logger;
    private client;
    private writeApi;
    constructor(config: InfluxDBConfig, logger: Logger);
    /**
     * Write consumption data to InfluxDB
     */
    writeConsumption(data: ConsumptionData): Promise<void>;
    /**
     * Write price data to InfluxDB
     */
    writePrice(data: PriceData): Promise<void>;
    /**
     * Write historical consumption data to InfluxDB
     */
    writeHistoricalData(dataPoints: HistoricalDataPoint[]): Promise<void>;
    /**
     * Write both consumption and price data
     */
    writeAll(consumption: ConsumptionData | null, price: PriceData | null): Promise<void>;
    /**
     * Close the InfluxDB client and flush any pending writes
     */
    close(): Promise<void>;
}
//# sourceMappingURL=influxdb.d.ts.map