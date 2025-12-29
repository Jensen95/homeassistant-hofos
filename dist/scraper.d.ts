import { Logger } from 'winston';
import { HoforCredentials, ScraperResult } from './types.js';
export declare class HoforScraper {
    private readonly credentials;
    private readonly logger;
    private readonly headless;
    private browser;
    private page;
    constructor(credentials: HoforCredentials, logger: Logger, headless?: boolean);
    /**
     * Initialize browser and page
     */
    private initBrowser;
    /**
     * Close browser and cleanup
     */
    close(): Promise<void>;
    /**
     * Login to HOFOR
     */
    private login;
    /**
     * Extract consumption data from the page
     */
    private extractConsumption;
    /**
     * Extract price per m³ from the page
     */
    private extractPricePerM3;
    /**
     * Scrape HOFOR data with retry logic
     */
    scrape(): Promise<ScraperResult>;
    /**
     * Perform a single scrape without retry logic (for testing)
     */
    scrapeOnce(): Promise<ScraperResult>;
}
//# sourceMappingURL=scraper.d.ts.map