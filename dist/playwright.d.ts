import { HistoricalDataPoint } from './types.js';
interface FetchOptions {
    startDate?: Date;
    endDate?: Date;
    kundenummer?: string;
    bsKundenummer?: string;
    headless?: boolean;
}
/**
 * Export the main function with retry logic
 */
export declare const fetchHoforData: (options?: FetchOptions) => Promise<HistoricalDataPoint[]>;
export {};
//# sourceMappingURL=playwright.d.ts.map