const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (p.url().includes('workItemCode=pPatSaneKVfy')) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  const url = new URL(page.url());
  url.pathname = '/list';
  ['pageCode', 'pageName', 'pageQuery', 'rowValue', 'componentType', 'editStatus', 'targetTreeType'].forEach((k) => url.searchParams.delete(k));
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: 'artifacts/session-outputs/TP-061-062-069-070-evidence/TP-070-ar-param-list.png', fullPage: false });
  console.log('rows:', await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).length));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
