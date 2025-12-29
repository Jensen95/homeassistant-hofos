import { chromium } from 'playwright';
import { HistoricalDataPoint } from './types.js';

const HOFOR_LOGIN_URL =
  'https://prod.tastselvservice.dk/Account/LogOn?ReturnUrl=/Consumption/RedirectToHOFORForbrug';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const CSV_HEADER_VALUE = 'Forbrug';
const CSV_INVALID_VALUE = '#N/A';

interface HoforCsvResponse {
  status: 'success' | 'error';
  data: string;
  fileName: string;
}

export interface FetchOptions {
  startDate?: Date;
  endDate?: Date;
  kundenummer: string;
  bsKundenummer: string;
  headless?: boolean;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
        const delay = RETRY_DELAY_MS * attempt;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Failed to fetch HOFOR data after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

async function fetchHoforDataInternal(options: FetchOptions): Promise<HistoricalDataPoint[]> {
  const {
    startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
    endDate = new Date(),
    kundenummer,
    bsKundenummer,
    headless = true,
  } = options;

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(HOFOR_LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });

    try {
      await page.getByRole('alert', { name: 'Kun nødvendige cookies' }).click({ timeout: 5000 });
    } catch (error) {
      console.warn('Cookie consent button not found or already accepted');
    }

    await page.getByRole('spinbutton', { name: 'Kundenummer (7xxxxxxx)' }).click();
    await page.getByRole('spinbutton', { name: 'Kundenummer (7xxxxxxx)' }).fill(kundenummer);
    await page.getByRole('spinbutton', { name: 'BS-kundenummer (8xxxxxxx)' }).click();
    await page.getByRole('spinbutton', { name: 'BS-kundenummer (8xxxxxxx)' }).fill(bsKundenummer);

    await page.getByRole('button', { name: 'Log ind' }).click();
    await page.getByRole('button', { name: 'klikke her' }).click();

    try {
      await page.getByRole('alert', { name: 'Afvis alle' }).click({ timeout: 5000 });
    } catch (error) {
      console.warn('Tracking cookie rejection button not found');
    }

    const dataResponsePromise = page.waitForResponse('**/wp-admin/admin-ajax.php');
    await page.getByRole('tab', { name: 'Dag' }).click();
    const response = await dataResponsePromise;

    const request = response.request();
    const body = new URLSearchParams(request.postData() || '');
    const csvBody = new URLSearchParams();
    csvBody.set('action', 'get_csv_data');
    csvBody.set('iid', body.get('iid') || '');
    csvBody.set('cid', body.get('cid') || '');
    csvBody.set('access_key', body.get('access_key') || '');
    csvBody.set('sdate', formatDate(startDate));
    csvBody.set('edate', formatDate(endDate));

    const csvResponse = await fetch('https://hofor-forbrug.dk/wp-admin/admin-ajax.php', {
      headers: {
        ...request.headers(),
      },
      method: 'POST',
      body: csvBody.toString(),
    });

    const csvData = ((await csvResponse.json()) as HoforCsvResponse).data;

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

export const fetchHoforData = async (options: FetchOptions): Promise<HistoricalDataPoint[]> => {
  return fetchWithRetry(options);
};
