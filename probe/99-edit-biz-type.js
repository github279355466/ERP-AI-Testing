const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const CODE = process.argv[3];
const NAME = process.argv[4];
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
  const input = page.locator('label[for="biz_type_gen_info.biz_type_name"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('input').first();
  await input.click();
  await input.fill(NAME);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  console.log('tail:', (await page.evaluate(() => document.body.innerText)).slice(-80));
  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2500);
  console.log('name:', await page.evaluate((value) => {
    const r = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((x) => (x.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return r ? (r.querySelector('.ag-cell[col-id="biz_type_name"]')?.textContent || '').trim() : null;
  }, CODE));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
