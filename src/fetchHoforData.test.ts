import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHoforData, type FetchOptions } from './fetchHoforData.js';
import type { HistoricalDataPoint } from './influxdb.types.js';

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          getByRole: vi.fn().mockReturnValue({
            click: vi.fn().mockResolvedValue(undefined),
            fill: vi.fn().mockResolvedValue(undefined),
          }),
          waitForResponse: vi.fn().mockResolvedValue({
            request: vi.fn().mockReturnValue({
              postData: vi.fn().mockReturnValue('iid=123&cid=456&access_key=abc'),
              headers: vi.fn().mockReturnValue({}),
            }),
          }),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

global.fetch = vi.fn();

describe('playwright', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchHoforData', () => {
    it('should successfully fetch and parse CSV data', async () => {
      const mockCsvData = 'Dato;Forbrug;Enhed\n01.01.2024;10.5;m³\n02.01.2024;12,3;m³';
      (global.fetch as any).mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockCsvData,
          fileName: 'test.csv',
        }),
      });

      const result = await fetchHoforData({
        kundenummer: '7123456',
        bsKundenummer: '81234567',
        headless: true,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '01.01.2024',
        usage: '10.5',
        metric: 'm³',
      });
      expect(result[1]).toEqual({
        date: '02.01.2024',
        usage: '12,3',
        metric: 'm³',
      });
    });

    it('should filter out header rows with "Forbrug"', async () => {
      const mockCsvData = 'Forbrug;Forbrug;Forbrug\n01.01.2024;10.5;m³';
      (global.fetch as any).mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockCsvData,
          fileName: 'test.csv',
        }),
      });

      const result = await fetchHoforData({
        kundenummer: '7123456',
        bsKundenummer: '81234567',
      });

      expect(result).toHaveLength(1);
      expect(result[0].date).toBe('01.01.2024');
    });

    it('should filter out invalid #N/A values', async () => {
      const mockCsvData = '01.01.2024;#N/A;m³\n02.01.2024;10.5;m³\n03.01.2024;#N/A;m³';
      (global.fetch as any).mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockCsvData,
          fileName: 'test.csv',
        }),
      });

      const result = await fetchHoforData({
        kundenummer: '7123456',
        bsKundenummer: '81234567',
      });

      expect(result).toHaveLength(1);
      expect(result[0].usage).toBe('10.5');
    });

    it('should filter out empty lines', async () => {
      const mockCsvData = '01.01.2024;10.5;m³\n\n\n02.01.2024;12.3;m³';
      (global.fetch as any).mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockCsvData,
          fileName: 'test.csv',
        }),
      });

      const result = await fetchHoforData({
        kundenummer: '7123456',
        bsKundenummer: '81234567',
      });

      expect(result).toHaveLength(2);
    });

    it('should use provided start and end dates', async () => {
      const mockCsvData = '01.01.2024;10.5;m³';
      const mockFetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockCsvData,
          fileName: 'test.csv',
        }),
      });
      global.fetch = mockFetch;

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      await fetchHoforData({
        kundenummer: '7123456',
        bsKundenummer: '81234567',
        startDate,
        endDate,
      });

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      const body = callArgs[1].body;
      expect(body).toContain('sdate=2024-01-01');
      expect(body).toContain('edate=2024-01-31');
    });

    it('should retry on failure with exponential backoff', async () => {
      let attemptCount = 0;
      (global.fetch as any).mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network error');
        }
        return Promise.resolve({
          json: vi.fn().mockResolvedValue({
            status: 'success',
            data: '01.01.2024;10.5;m³',
            fileName: 'test.csv',
          }),
        });
      });

      const result = await fetchHoforData({
        kundenummer: '7123456',
        bsKundenummer: '81234567',
      });

      expect(attemptCount).toBe(3);
      expect(result).toHaveLength(1);
      expect(console.log).toHaveBeenCalledWith('Fetch attempt 1/3');
      expect(console.log).toHaveBeenCalledWith('Fetch attempt 2/3');
      expect(console.log).toHaveBeenCalledWith('Fetch attempt 3/3');
    });

    it('should throw error after max retries', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(
        fetchHoforData({
          kundenummer: '7123456',
          bsKundenummer: '81234567',
        })
      ).rejects.toThrow('Failed to fetch HOFOR data after 3 attempts');
    });

    it('should handle empty CSV data', async () => {
      (global.fetch as any).mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: '',
          fileName: 'test.csv',
        }),
      });

      const result = await fetchHoforData({
        kundenummer: '7123456',
        bsKundenummer: '81234567',
      });

      expect(result).toHaveLength(0);
    });

    it('should require kundenummer and bsKundenummer', async () => {
      const options = {
        kundenummer: '',
        bsKundenummer: '',
      } as FetchOptions;

      (global.fetch as any).mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: '01.01.2024;10.5;m³',
          fileName: 'test.csv',
        }),
      });

      await fetchHoforData(options);

      const { chromium } = await import('playwright');
      expect(chromium.launch).toHaveBeenCalled();
    });
  });
});
