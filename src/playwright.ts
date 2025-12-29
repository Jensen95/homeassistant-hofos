import { chromium } from 'playwright';
import { HistoricalDataPoint } from './types.js';

const HOFOR_LOGIN_URL =
  'https://prod.tastselvservice.dk/Account/LogOn?ReturnUrl=/Consumption/RedirectToHOFORForbrug';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// CSV parsing constants
const CSV_HEADER_VALUE = 'Forbrug';
const CSV_INVALID_VALUE = '#N/A';

interface HoforCsvResponse {
  status: 'success' | 'error';
  data: string;
  fileName: string;
}

interface FetchOptions {
  startDate?: Date;
  endDate?: Date;
  kundenummer?: string;
  bsKundenummer?: string;
  headless?: boolean;
}

/**
 * Format date as YYYY-MM-DD for API requests
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Fetch HOFOR data with retry logic and configurable date range
 */
async function fetchWithRetry(options: FetchOptions): Promise<HistoricalDataPoint[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Fetch attempt ${attempt}/${MAX_RETRIES}`);
      return await fetchHoforDataInternal(options);
    } catch (error) {
      lastError = error as Error;
      console.error(`Fetch attempt ${attempt} failed:`, error);

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt; // Exponential backoff
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to fetch HOFOR data after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

/**
 * Internal function to fetch HOFOR data
 */
async function fetchHoforDataInternal(options: FetchOptions): Promise<HistoricalDataPoint[]> {
  const {
    startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
    endDate = new Date(),
    kundenummer = process.env.HOFOR_KUNDENUMMER || '',
    bsKundenummer = process.env.HOFOR_BS_KUNDENUMMER || '',
    headless = true,
  } = options;

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    await page.goto(HOFOR_LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Accept cookie consent
    try {
      await page.getByRole('alert', { name: 'Kun nødvendige cookies' }).click({ timeout: 5000 });
    } catch (error) {
      console.warn('Cookie consent button not found or already accepted');
    }

    // Fill in login credentials
    await page.getByRole('spinbutton', { name: 'Kundenummer (7xxxxxxx)' }).click();
    await page.getByRole('spinbutton', { name: 'Kundenummer (7xxxxxxx)' }).fill(kundenummer);
    await page.getByRole('spinbutton', { name: 'BS-kundenummer (8xxxxxxx)' }).click();
    await page.getByRole('spinbutton', { name: 'BS-kundenummer (8xxxxxxx)' }).fill(bsKundenummer);

    // Login
    await page.getByRole('button', { name: 'Log ind' }).click();
    await page.getByRole('button', { name: 'klikke her' }).click();

    // Reject tracking cookies
    try {
      await page.getByRole('alert', { name: 'Afvis alle' }).click({ timeout: 5000 });
    } catch (error) {
      console.warn('Tracking cookie rejection button not found');
    }

    // Wait for data response and click on day tab
    const dataResponsePromise = page.waitForResponse('**/wp-admin/admin-ajax.php');
    await page.getByRole('tab', { name: 'Dag' }).click();
    const response = await dataResponsePromise;

    // Extract request parameters for CSV download
    const request = response.request();
    const body = new URLSearchParams(request.postData() || '');
    const csvBody = new URLSearchParams();
    csvBody.set('action', 'get_csv_data');
    csvBody.set('iid', body.get('iid') || '');
    csvBody.set('cid', body.get('cid') || '');
    csvBody.set('access_key', body.get('access_key') || '');
    csvBody.set('sdate', formatDate(startDate));
    csvBody.set('edate', formatDate(endDate));

    // Fetch CSV data
    const csvResponse = await fetch('https://hofor-forbrug.dk/wp-admin/admin-ajax.php', {
      headers: {
        ...request.headers(),
      },
      method: 'POST',
      body: csvBody.toString(),
    });

    const csvData = ((await csvResponse.json()) as HoforCsvResponse).data;

    // Parse CSV data
    const data = csvData.split('\n').reduce(
      (acc, line) => {
        const [date, usage, metric] = line.split(';');
        if (usage === CSV_HEADER_VALUE || usage === CSV_INVALID_VALUE || !date || !usage) {
          return acc;
        }
        acc.push({ date, usage, metric });
        return acc;
      },
      [] as HistoricalDataPoint[]
    );

    return data;
  } finally {
    await context.close();
    await browser.close();
  }
}

/**
 * Export the main function with retry logic
 */
export const fetchHoforData = async (options: FetchOptions = {}): Promise<HistoricalDataPoint[]> => {
  return fetchWithRetry(options);
};
