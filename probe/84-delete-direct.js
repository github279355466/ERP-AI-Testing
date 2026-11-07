const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const CODE = process.argv[3];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === TITLE) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(1000);
  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  console.log('index:', index);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '删除' }).first().click();
  await page.waitForTimeout(1000);
  const dialog = page.locator('.rc-dialog:visible').last();
  console.log('dialog:', (await dialog.innerText()).replace(/\s+/g, ' ').trim());
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await page.waitForTimeout(3000);
  const exists = await page.evaluate((value) => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).some((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value), CODE);
  console.log('exists:', exists, 'tail:', (await page.evaluate(() => document.body.innerText)).slice(-100));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
