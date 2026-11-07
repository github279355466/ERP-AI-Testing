const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === TITLE) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  console.log('reloaded:', page.url().split('?')[0], await page.evaluate(() => document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
