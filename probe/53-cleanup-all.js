const { chromium } = require('@playwright/test');
const isTest = (no) => /^T064-(12|13|14)-/.test(no) || no === 'T064-20261106-A1' || no === 'T064-20261106-B1';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (candidate.url().includes('/list') && candidate.url().includes('workItemCode=cEBGcJzbDWkQ')) page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();

  await page.locator('button:visible', { hasText: '筛选' }).first().click();
  await page.waitForTimeout(600);
  const root = page.locator('[class*="MultiConditionFilter-module_popover-content"]').first();
  await root.locator('button', { hasText: '清空' }).last().click();
  await page.waitForTimeout(300);
  await root.locator('button', { hasText: '筛选' }).last().click();
  await page.waitForTimeout(2000);

  for (let round = 0; round < 10; round += 1) {
    const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).map((r) => ({
      i: Number(r.getAttribute('row-index')),
      no: (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim(),
    })));
    const target = rows.find((r) => isTest(r.no));
    if (!target) break;
    console.log('deleting', target.no);
    await page.locator(`.ag-row[row-index="${target.i}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '删除' }).first().click();
    await page.waitForTimeout(900);
    await page.locator('.rc-dialog:visible').last().getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForTimeout(2500);
  }
  console.log('remaining:', await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).map((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim())));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
