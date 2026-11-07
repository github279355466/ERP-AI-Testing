const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const CODE = process.argv[3];
const VERF = process.argv[4] || '明细';
const PREFIX = TITLE.includes('应付') ? 'biz_type_ap_param' : 'biz_type_ar_param';
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
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '编辑' }).first().click();
  await page.waitForTimeout(2000);

  const item = page.locator(`label[for="${PREFIX}.verf_mode"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  await item.locator('.ath-select').first().click();
  await page.waitForTimeout(500);
  await page.locator('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option').filter({ hasText: new RegExp(`^${VERF}$`) }).last().click();
  await page.waitForTimeout(800);

  const auto = page.locator(`label[for="${PREFIX}.creat_is_auto_aprv"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('button[role="switch"]').first();
  console.log('auto before:', await auto.getAttribute('aria-checked'));
  if ((await auto.getAttribute('aria-checked')) === 'true') await auto.click();
  await page.waitForTimeout(500);

  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  console.log('tail:', (await page.evaluate(() => document.body.innerText)).slice(-150));
  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2500);
  const row = await page.evaluate((value) => {
    const r = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((x) => (x.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return r ? Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])) : null;
  }, CODE);
  console.log('after edit:', JSON.stringify(row, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
