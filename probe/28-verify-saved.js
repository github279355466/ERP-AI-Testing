const { chromium } = require('@playwright/test');
const NO = 'T064-20261106-A1';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间表') page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();

  console.log('tabs before close:', await page.evaluate(() => Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim())));
  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  console.log('discard guard shown:', await discard.count());
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(1500);

  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((row) => ({
    index: row.getAttribute('row-index'),
    cells: Object.fromEntries(Array.from(row.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
  })));
  console.log('rows:', rows.length);
  console.log(JSON.stringify(rows.filter((r) => r.cells.acctg_perid_table_no === NO), null, 2));
  console.log('all nos:', rows.map((r) => r.cells.acctg_perid_table_no).join(','));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
