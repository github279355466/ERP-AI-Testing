const { chromium } = require('@playwright/test');
const NO = 'T064-20261106-B1';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间表') page = candidate;
  }
  await page.bringToFront();
  const index = await page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
    const row = rows.find((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, NO);
  console.log('index:', index);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '查看' }).first().click();
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    return {
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim()),
      rows: rows.length,
      first: rows.slice(0, 2).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
      last: rows.slice(-2).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
      body: (document.body.innerText || '').slice(0, 500),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
