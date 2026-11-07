const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const pages = context.pages();
  let page = null;
  for (const candidate of pages) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间表') page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();

  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1000);

  const readRows = async () =>
    page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(
        (row) => row.offsetWidth > 0,
      );
      return {
        count: rows.length,
        head: rows.slice(0, 2).map((row) => {
          const cells = {};
          row.querySelectorAll('.ag-cell[col-id]').forEach((cell) => {
            cells[cell.getAttribute('col-id')] = (cell.textContent || '').trim();
          });
          return cells;
        }),
        tail: rows.slice(-3).map((row) => {
          const cells = {};
          row.querySelectorAll('.ag-cell[col-id]').forEach((cell) => {
            cells[cell.getAttribute('col-id')] = (cell.textContent || '').trim();
          });
          return cells;
        }),
      };
    });

  const item = page.locator('[class*="FormItem-module_form-item__"]').filter({ has: page.locator('label[for="acctg_perid_table.insta_count"]') });
  const input = item.locator('input').first();

  for (const value of ['13', '14']) {
    await input.click();
    await input.fill(value);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(1000);
    console.log(value, JSON.stringify(await readRows(), null, 2));
  }

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
