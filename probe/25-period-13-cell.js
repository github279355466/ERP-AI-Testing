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
  await input.fill('13');
  await page.locator('label[for="acctg_perid_table.acctg_perid_table_name"]').click();
  await page.waitForTimeout(1000);

  const state = await page.evaluate(() => {
    const readRow = (index) => {
      const row = document.querySelector(`.ag-center-cols-container .ag-row[row-index="${index}"]`);
      if (!row) return null;
      const cells = {};
      row.querySelectorAll('.ag-cell[col-id]').forEach((cell) => {
        const input = cell.querySelector('input');
        cells[cell.getAttribute('col-id')] = {
          text: (cell.textContent || '').trim(),
          inputChecked: input ? input.checked : null,
          inputType: input ? input.type : null,
          html: cell.innerHTML.slice(0, 900),
        };
      });
      return cells;
    };
    return {
      min: document.querySelector('input.input-number-input')?.getAttribute('aria-valuemin'),
      max: document.querySelector('input.input-number-input')?.getAttribute('aria-valuemax'),
      row11: readRow(11),
      row12: readRow(12),
    };
  });
  console.log(JSON.stringify(state, null, 2));

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
