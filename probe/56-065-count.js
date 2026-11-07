const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (candidate.url().includes('/list') && candidate.url().includes('workItemCode=hoRpQwPEmnlK')) page = candidate;
  }
  await page.bringToFront();
  await page.waitForTimeout(1000);
  console.log(JSON.stringify(await page.evaluate(() => ({
    rows: Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim()),
    footer: (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0],
  })), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
