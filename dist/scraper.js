import { chromium } from 'playwright';
import { ScraperError, } from './types.js';
const HOFOR_LOGIN_URL = 'https://prod.tastselvservice.dk/Account/LogOn?ReturnUrl=/Consumption/RedirectToHOFORForbrug';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
export class HoforScraper {
    credentials;
    logger;
    headless;
    browser = null;
    page = null;
    constructor(credentials, logger, headless = true) {
        this.credentials = credentials;
        this.logger = logger;
        this.headless = headless;
    }
    /**
     * Initialize browser and page
     */
    async initBrowser() {
        if (this.browser) {
            return;
        }
        this.logger.info('Initializing browser...');
        this.browser = await chromium.launch({
            headless: this.headless,
        });
        this.page = await this.browser.newPage();
        this.logger.debug('Browser initialized successfully');
    }
    /**
     * Close browser and cleanup
     */
    async close() {
        if (this.page) {
            await this.page.close();
            this.page = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
        this.logger.info('Browser closed');
    }
    /**
     * Login to HOFOR
     */
    async login() {
        if (!this.page) {
            throw new ScraperError('Browser not initialized', 'BROWSER_NOT_INITIALIZED');
        }
        this.logger.info('Navigating to login page...');
        await this.page.goto(HOFOR_LOGIN_URL, { waitUntil: 'networkidle' });
        // Fill in credentials
        this.logger.debug('Entering credentials...');
        await this.page.fill('input[name="UserName"]', this.credentials.username);
        await this.page.fill('input[name="Password"]', this.credentials.password);
        // Click login button
        this.logger.debug('Clicking login button...');
        await this.page.click('button[type="submit"], input[type="submit"]');
        // Wait for navigation after login
        await this.page.waitForLoadState('networkidle');
        // Check if login was successful by looking for error messages or successful navigation
        const currentUrl = this.page.url();
        if (currentUrl.includes('LogOn')) {
            // Still on login page, check for error message
            const errorElement = await this.page.$('.validation-summary-errors, .alert-danger');
            if (errorElement) {
                const errorText = await errorElement.textContent();
                throw new ScraperError(`Login failed: ${errorText?.trim() || 'Invalid credentials'}`, 'LOGIN_FAILED', false);
            }
        }
        this.logger.info('Login successful');
    }
    /**
     * Extract consumption data from the page
     */
    async extractConsumption() {
        if (!this.page) {
            throw new ScraperError('Browser not initialized', 'BROWSER_NOT_INITIALIZED');
        }
        this.logger.debug('Extracting consumption data...');
        // TODO: Update selectors based on actual HOFOR page structure
        // This is a placeholder implementation that needs to be adjusted
        // based on the actual DOM structure of the HOFOR consumption page
        try {
            // Wait for consumption data to load
            await this.page.waitForSelector('.consumption-data, [data-consumption]', {
                timeout: 10000,
            });
            // Extract the consumption value
            // These selectors need to be updated based on actual page structure
            const consumptionText = await this.page.textContent('.consumption-value, [data-consumption-value]');
            if (!consumptionText) {
                this.logger.warn('No consumption data found on page');
                return null;
            }
            // Parse the consumption value (remove non-numeric characters except decimal point)
            const consumptionValue = parseFloat(consumptionText.replace(/[^\d.,]/g, '').replace(',', '.'));
            if (isNaN(consumptionValue)) {
                throw new ScraperError(`Invalid consumption value: ${consumptionText}`, 'INVALID_CONSUMPTION_VALUE');
            }
            const consumption = {
                value: consumptionValue,
                timestamp: new Date(),
                unit: 'm³',
            };
            this.logger.info(`Extracted consumption: ${consumptionValue} m³`);
            return consumption;
        }
        catch (error) {
            if (error instanceof ScraperError) {
                throw error;
            }
            this.logger.error('Failed to extract consumption data', { error });
            throw new ScraperError('Failed to extract consumption data', 'EXTRACTION_FAILED', true);
        }
    }
    /**
     * Extract price per m³ from the page
     */
    async extractPricePerM3() {
        if (!this.page) {
            throw new ScraperError('Browser not initialized', 'BROWSER_NOT_INITIALIZED');
        }
        this.logger.debug('Extracting price data...');
        // TODO: Update selectors based on actual HOFOR page structure
        // This is a placeholder implementation that needs to be adjusted
        // based on the actual DOM structure of the HOFOR pricing page
        try {
            // Wait for price data to load
            await this.page.waitForSelector('.price-data, [data-price]', { timeout: 10000 });
            // Extract the price value
            const priceText = await this.page.textContent('.price-value, [data-price-value]');
            if (!priceText) {
                this.logger.warn('No price data found on page');
                return null;
            }
            // Parse the price value (remove non-numeric characters except decimal point)
            const priceValue = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
            if (isNaN(priceValue)) {
                throw new ScraperError(`Invalid price value: ${priceText}`, 'INVALID_PRICE_VALUE');
            }
            const price = {
                pricePerM3: priceValue,
                currency: 'DKK',
                timestamp: new Date(),
            };
            this.logger.info(`Extracted price: ${priceValue} DKK/m³`);
            return price;
        }
        catch (error) {
            if (error instanceof ScraperError) {
                throw error;
            }
            this.logger.error('Failed to extract price data', { error });
            throw new ScraperError('Failed to extract price data', 'EXTRACTION_FAILED', true);
        }
    }
    /**
     * Scrape HOFOR data with retry logic
     */
    async scrape() {
        let lastError = null;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                this.logger.info(`Scraping attempt ${attempt}/${MAX_RETRIES}`);
                // Initialize browser if needed
                await this.initBrowser();
                // Login to HOFOR
                await this.login();
                // Extract consumption and price data
                const consumption = await this.extractConsumption();
                const price = await this.extractPricePerM3();
                // Cleanup
                await this.close();
                return {
                    consumption,
                    price,
                    success: true,
                };
            }
            catch (error) {
                lastError = error;
                this.logger.error(`Scraping attempt ${attempt} failed`, { error });
                // Close browser on error
                await this.close();
                // Check if error is retryable
                if (error instanceof ScraperError && !error.retryable) {
                    this.logger.error('Non-retryable error encountered, aborting');
                    break;
                }
                // Wait before retry (except on last attempt)
                if (attempt < MAX_RETRIES) {
                    const delay = RETRY_DELAY_MS * attempt; // Exponential backoff
                    this.logger.info(`Waiting ${delay}ms before retry...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
        // All retries failed
        return {
            consumption: null,
            price: null,
            success: false,
            error: lastError?.message || 'Unknown error',
        };
    }
    /**
     * Perform a single scrape without retry logic (for testing)
     */
    async scrapeOnce() {
        try {
            await this.initBrowser();
            await this.login();
            const consumption = await this.extractConsumption();
            const price = await this.extractPricePerM3();
            await this.close();
            return {
                consumption,
                price,
                success: true,
            };
        }
        catch (error) {
            await this.close();
            return {
                consumption: null,
                price: null,
                success: false,
                error: error.message,
            };
        }
    }
}
//# sourceMappingURL=scraper.js.map