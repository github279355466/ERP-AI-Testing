const { chromium } = require('@playwright/test');
const NO = 'T064-20261106-B1';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间信息') page = candidate;
  }
  await page.bringToFront();
  await page.waitForTimeout(2000);
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((row) => ({
    index: row.getAttribute('row-index'),
    cells: Object.fromEntries(Array.from(row.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
  })));
  console.log('rows:', rows.length);
  console.log(JSON.stringify(rows, null, 2));
  console.log('footer:', await page.evaluate(() => (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0]));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
