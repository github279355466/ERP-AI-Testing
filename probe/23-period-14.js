const { chromium } = require('@playwright/test');

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

  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1000);

  const item = page.locator('[class*="FormItem-module_form-item__"]').filter({
    has: page.locator('label[for="acctg_perid_table.insta_count"]'),
  });
  const input = item.locator('input').first();
  await input.click();
  await input.fill('14');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1200);

  const collect = async () =>
    page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
      const indexes = [...new Set(rows.map((row) => Number(row.getAttribute('row-index'))))].sort((a, b) => a - b);
      const read = (index) => {
        const row = document.querySelector(`.ag-center-cols-container .ag-row[row-index="${index}"]`);
        if (!row) return null;
        const cells = {};
        row.querySelectorAll('.ag-cell[col-id]').forEach((cell) => {
          cells[cell.getAttribute('col-id')] = {
            text: (cell.textContent || '').trim(),
            html: cell.innerHTML.slice(0, 500),
          };
        });
        return cells;
      };
      return { indexes, count: indexes.length, row12: read(12), row13: read(13) };
    });

  console.log('BEFORE-SCROLL', JSON.stringify(await collect(), null, 2));

  await page.evaluate(() => {
    const viewport = document.querySelector('.ag-body-viewport');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  });
  await page.waitForTimeout(800);
  console.log('AFTER-SCROLL', JSON.stringify(await collect(), null, 2));

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
