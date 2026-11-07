const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const OPS = process.argv[3];
const BIZ = process.argv[4];
const VERF = process.argv[5] || '分期';
const OFFSET = process.argv[6] || 'AR01';
const PREFIX = TITLE.includes('应付') ? 'biz_type_ap_param' : 'biz_type_ar_param';

async function pickLookup(page, fieldPath, text) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const box = await item.locator('[class*="WindowSelect-module_windowSelect"]').first().boundingBox();
  await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
  await page.waitForTimeout(1000);
  const modal = page.locator('.rc-dialog-wrap:visible').last();
  const row = modal.locator('.ag-center-cols-container .ag-row[row-index]').filter({ hasText: text }).first();
  console.log(`${fieldPath}: rows=${await modal.locator('.ag-center-cols-container .ag-row[row-index]').count()} target=${await row.count()}`);
  await row.click();
  await page.waitForTimeout(300);
  await modal.getByRole('button', { name: '确认', exact: true }).last().click();
  await page.waitForTimeout(900);
}

async function selectOption(page, fieldPath, text) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  await item.locator('.ath-select').first().click();
  await page.waitForTimeout(500);
  await page.locator('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option').filter({ hasText: new RegExp(`^${text}$`) }).last().click();
  await page.waitForTimeout(800);
}

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
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);

  await pickLookup(page, `${PREFIX}.ops_unit_no`, OPS);
  await pickLookup(page, `${PREFIX}.biz_type_no`, BIZ);
  await selectOption(page, `${PREFIX}.verf_mode`, VERF);
  if (VERF === '分期') await pickLookup(page, `${PREFIX}.insta_offst_adv_biz_type_no`, OFFSET);

  const auto = page.locator(`label[for="${PREFIX}.creat_is_auto_aprv"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('button[role="switch"]').first();
  if ((await auto.getAttribute('aria-checked')) !== 'true') await auto.click();
  await page.waitForTimeout(500);

  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  console.log('after save tail:', (await page.evaluate(() => document.body.innerText)).slice(-200));

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2500);

  const row = await page.evaluate((biz) => {
    const r = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((x) => (x.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === biz);
    return r ? { i: r.getAttribute('row-index'), cells: Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])) } : null;
  }, BIZ);
  console.log('created row:', JSON.stringify(row, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
