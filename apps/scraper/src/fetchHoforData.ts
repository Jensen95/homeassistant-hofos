import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';

import type { HistoricalDataPoint } from './influxdb.types.js';

const HOFOR_LOGIN_URL =
  'https://prod.tastselvservice.dk/Account/LogOn?ReturnUrl=/Consumption/RedirectToHOFORForbrug';
const HOFOR_CSV_ENDPOINT = 'https://hofor-forbrug.dk/wp-admin/admin-ajax.php';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const CSV_HEADER_VALUE = 'Forbrug';
const CSV_INVALID_VALUE = '#N/A';
const PAGE_TIMEOUT = 30_000;
const COOKIE_TIMEOUT = 5000;

export interface FetchOptions {
  bsKundenummer: string;
  endDate?: Date;
  headless?: boolean;
  kundenummer: string;
  startDate?: Date;
}

interface HoforCsvResponse {
  data: string;
  fileName: string;
  status: 'error' | 'success';
}

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseCSV = (csvData: string): HistoricalDataPoint[] => {
  return csvData
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .reduce((accumulator, line) => {
      const [date, usage, metric] = line.split(';');

      if (!date || !usage || usage === CSV_HEADER_VALUE || usage === CSV_INVALID_VALUE) {
        return accumulator;
      }

      accumulator.push({ date, metric: metric || '', usage });
      return accumulator;
    }, [] as HistoricalDataPoint[]);
};

const handleCookieConsent = async (page: Page): Promise<void> => {
  try {
    await page
      .getByRole('alert', { name: 'Kun nødvendige cookies' })
      .click({ timeout: COOKIE_TIMEOUT });
  } catch {
    console.warn('Cookie consent button not found or already accepted');
  }
};

const handleTrackingRejection = async (page: Page): Promise<void> => {
  try {
    await page.getByRole('alert', { name: 'Afvis alle' }).click({ timeout: COOKIE_TIMEOUT });
  } catch {
    console.warn('Tracking cookie rejection button not found');
  }
};

const performLogin = async (
  page: Page,
  kundenummer: string,
  bsKundenummer: string
): Promise<void> => {
  await page.getByRole('spinbutton', { name: 'Kundenummer (7xxxxxxx)' }).fill(kundenummer);
  await page.getByRole('spinbutton', { name: 'BS-kundenummer (8xxxxxxx)' }).fill(bsKundenummer);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await page.getByRole('button', { name: 'klikke her' }).click();
};

const extractCSVParameters = async (page: Page): Promise<URLSearchParams> => {
  const dataResponsePromise = page.waitForResponse('**/wp-admin/admin-ajax.php');
  await page.getByRole('tab', { name: 'Dag' }).click();
  const response = await dataResponsePromise;

  const request = response.request();
  const body = new URLSearchParams(request.postData() || '');

  return body;
};

const downloadCSV = async (
  headers: Record<string, string>,
  parameters: URLSearchParams,
  startDate: Date,
  endDate: Date
): Promise<string> => {
  const csvBody = new URLSearchParams();
  csvBody.set('action', 'get_csv_data');
  csvBody.set('iid', parameters.get('iid') || '');
  csvBody.set('cid', parameters.get('cid') || '');
  csvBody.set('access_key', parameters.get('access_key') || '');
  csvBody.set('sdate', formatDate(startDate));
  csvBody.set('edate', formatDate(endDate));

  const csvResponse = await fetch(HOFOR_CSV_ENDPOINT, {
    body: csvBody.toString(),
    headers,
    method: 'POST',
  });

  const jsonResponse = (await csvResponse.json()) as HoforCsvResponse;
  return jsonResponse.data;
};

const fetchHoforDataInternal = async (options: FetchOptions): Promise<HistoricalDataPoint[]> => {
  const {
    bsKundenummer,
    endDate = new Date(),
    headless = true,
    kundenummer,
    startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
  } = options;

  let browser: Browser | undefined = undefined;
  let context: BrowserContext | undefined = undefined;

  try {
    browser = await chromium.launch({ headless });
    context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(HOFOR_LOGIN_URL, { timeout: PAGE_TIMEOUT, waitUntil: 'networkidle' });
    await handleCookieConsent(page);
    await performLogin(page, kundenummer, bsKundenummer);
    await handleTrackingRejection(page);

    const parameters = await extractCSVParameters(page);
    const response = await page.waitForResponse('**/wp-admin/admin-ajax.php');
    const request = response.request();
    const csvData = await downloadCSV(request.headers(), parameters, startDate, endDate);

    return parseCSV(csvData);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
};

const fetchWithRetry = async (options: FetchOptions): Promise<HistoricalDataPoint[]> => {
  let lastError: Error | undefined = undefined;

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

  throw new Error(
    `Failed to fetch HOFOR data after ${MAX_RETRIES} attempts: ${lastError?.message}`
  );
};

export const fetchHoforData = async (options: FetchOptions): Promise<HistoricalDataPoint[]> => {
  return fetchWithRetry(options);
};
