const { chromium } = require('playwright');

const PROXY = 'http://127.0.0.1:10808';
const TARGET = 'https://athena-test.digiwincloud.com.cn/';

(async () => {
  const browser = await chromium.launch({ headless: true, proxy: { server: PROXY } });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  const logs = [];
  const failed = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => failed.push(`${r.failure().errorText} ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`HTTP ${r.status()} ${r.url()}`);
  });

  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(15000);

  console.log('URL', page.url());
  console.log('TITLE', await page.title());
  console.log('--- HTML HEAD ---');
  console.log((await page.content()).slice(0, 2500));
  console.log('--- CONSOLE ---');
  console.log(logs.slice(-40).join('\n') || '(none)');
  console.log('--- FAILED ---');
  console.log(failed.slice(-40).join('\n') || '(none)');

  await page.screenshot({ path: 'probe/home-wait.png' });
  await browser.close();
})();
