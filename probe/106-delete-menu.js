const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const COLUMN = process.argv[3];
const VALUE = process.argv[4];
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
  await page.waitForTimeout(1200);
  const indexOf = async () => page.evaluate(({ column, value }) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector(`.ag-cell[col-id="${column}"]`)?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, { column: COLUMN, value: VALUE });
  let index = await indexOf();
  console.log('index:', index);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('.digi-dropdown-menu:visible').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => undefined);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first().click();
  await page.locator('.digi-dropdown-menu:visible').last().waitFor({ state: 'visible', timeout: 5000 });
  const item = page.locator('.digi-dropdown-menu:visible .digi-dropdown-menu-item').filter({ hasText: /^删除$/ }).last();
  await item.waitFor({ state: 'visible', timeout: 5000 });
  await item.click();
  await page.waitForTimeout(1000);
  const dialog = page.locator('.rc-dialog:visible').last();
  console.log('dialog:', (await dialog.innerText()).replace(/\s+/g, ' ').trim());
  await dialog.getByRole('button', { name: '确定', exact: true }).click();
  await page.waitForTimeout(4000);
  console.log('exists:', await indexOf(), 'tail:', (await page.evaluate(() => document.body.innerText)).slice(-120));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
