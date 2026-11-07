const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间信息') page = candidate;
  }
  await page.bringToFront();
  const info = await page.evaluate(() => ({
    tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim()),
    body: (document.body.innerText || '').slice(0, 1600),
    gridRowsAll: document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length,
    visibleGrids: Array.from(document.querySelectorAll('.ag-center-cols-container')).filter((el) => el.offsetWidth > 0).map((el) => el.querySelectorAll('.ag-row[row-index]').length),
    tableTriggerText: (document.querySelector('label[for="acctg_perid_info.acctg_perid_table_no"]')?.closest('[class*="form-item__"]')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }));
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
