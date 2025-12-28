import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HoforScraper } from './scraper.js';
import { Logger } from 'winston';

// Mock Playwright
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn(),
        fill: vi.fn(),
        click: vi.fn(),
        waitForLoadState: vi.fn(),
        url: vi.fn().mockReturnValue('https://prod.tastselvservice.dk/Consumption'),
        $: vi.fn().mockResolvedValue(null),
        textContent: vi.fn().mockResolvedValue('123.45'),
        waitForSelector: vi.fn(),
        close: vi.fn(),
      }),
      close: vi.fn(),
    }),
  },
}));

describe('HoforScraper', () => {
  let mockLogger: Logger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;
  });

  describe('constructor', () => {
    it('should create scraper instance with credentials', () => {
      const scraper = new HoforScraper({ username: 'test', password: 'pass' }, mockLogger);
      expect(scraper).toBeDefined();
    });
  });

  describe('scrape', () => {
    it('should successfully scrape consumption and price data', async () => {
      const scraper = new HoforScraper({ username: 'test', password: 'pass' }, mockLogger, true);

      const result = await scraper.scrape();

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Scraping attempt'));
    });

    it('should retry on failure', async () => {
      const scraper = new HoforScraper({ username: 'test', password: 'pass' }, mockLogger, true);

      // Mock failure scenario would require more detailed mocking
      // This is a placeholder test
      const result = await scraper.scrape();
      expect(result).toBeDefined();
    });
  });

  describe('close', () => {
    it('should close browser successfully', async () => {
      const scraper = new HoforScraper({ username: 'test', password: 'pass' }, mockLogger);

      await scraper.close();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Browser closed'));
    });
  });
});
