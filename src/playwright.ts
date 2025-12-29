import { chromium } from 'playwright';

const HOFOR_LOGIN_URL =
  'https://prod.tastselvservice.dk/Account/LogOn?ReturnUrl=/Consumption/RedirectToHOFORForbrug';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

interface HoforDataResponse {
  status: 'success' | 'error';
  label: string;
  unit: 'm³';
  data: {
    chartData: {
      xAxis: { categories: string[] };
      series: [{ name: 'Forbrug'; data: { y: string; name: 'm³' }[] }];
    };
  };
}

interface HoforCsvResponse {
  status: 'success' | 'error';
  data: string;
  fileName: string;
}

export const fetchHoforData = async () => {
  const browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(HOFOR_LOGIN_URL);
  await page.getByRole('alert', { name: 'Kun nødvendige cookies' }).click();
  await page.getByRole('spinbutton', { name: 'Kundenummer (7xxxxxxx)' }).click();
  await page
    .getByRole('spinbutton', { name: 'Kundenummer (7xxxxxxx)' })
    .fill(process.env.HOFOR_KUNDENUMMER || '');
  await page.getByRole('spinbutton', { name: 'BS-kundenummer (8xxxxxxx)' }).click();
  await page
    .getByRole('spinbutton', { name: 'BS-kundenummer (8xxxxxxx)' })
    .fill(process.env.HOFOR_BS_KUNDENUMMER || '');

  await page.getByRole('button', { name: 'Log ind' }).click();
  await page.getByRole('button', { name: 'klikke her' }).click();
  await page.getByRole('alert', { name: 'Afvis alle' }).click();
  const dataResponse = page.waitForResponse('**/wp-admin/admin-ajax.php');

  await page.getByRole('tab', { name: 'Dag' }).click();
  const response = await dataResponse;

  const request = response.request();
  const body = new URLSearchParams(request.postData() || '');
  const csvBody = new URLSearchParams();
  csvBody.set('action', 'get_csv_data');
  csvBody.set('iid', body.get('iid') || '');
  csvBody.set('cid', body.get('cid') || '');
  csvBody.set('access_key', body.get('access_key') || '');
  // TODO: Dynamically set start date to today's date minus one year
  csvBody.set('sdate', '2025-01-01');
  // TODO: Dynamically set end date to today's date
  csvBody.set('edate', '2025-12-31');

  const lastYearResponse = await fetch('https://hofor-forbrug.dk/wp-admin/admin-ajax.php', {
    headers: {
      ...request.headers(),
    },
    method: 'POST',
    body: csvBody.toString(),
  });
  const lastYearData = ((await lastYearResponse.json()) as HoforCsvResponse).data;
  const data = lastYearData.split('\n').reduce(
    (acc, line) => {
      const [date, usage, metric] = line.split(';');
      if (usage === 'Forbrug' || usage === '#N/A' || !date || !usage) {
        console.warn('Skipping invalid line:', { date, usage, metric, line });
        return acc;
      }
      acc.push({ date, usage: usage, metric });
      return acc;
    },
    [] as { date: string; usage: string; metric: string }[]
  );
  console.log('Last year data:', data);

  await context.close();
  await browser.close();

  return data;
};
