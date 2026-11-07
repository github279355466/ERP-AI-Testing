const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (candidate.url().includes('/list') && candidate.url().includes('workItemCode=cEBGcJzbDWkQ')) page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(1000);
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((r) => ({
    i: r.getAttribute('row-index'),
    no: (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim(),
  })));
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
