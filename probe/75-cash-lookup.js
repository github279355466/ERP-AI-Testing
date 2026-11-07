const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const BIZ = process.argv[3];
const PREFIX = TITLE.includes('应付') ? 'biz_type_ap_param' : 'biz_type_ar_param';

async function selectOption(page, fieldPath, text) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  await item.locator('.ath-select').first().click();
  await page.waitForTimeout(500);
  await page.locator('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option').filter({ hasText: new RegExp(`^${text}$`) }).last().click();
  await page.waitForTimeout(800);
}

async function openLookup(page, fieldPath) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const trigger = item.locator('[class*="WindowSelect-module_windowSelect"]').first();
  const box = await trigger.boundingBox();
  await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
  await page.waitForTimeout(1200);
  return page.locator('.rc-dialog-wrap:visible').last();
}

async function pickLookup(page, fieldPath, text) {
  const modal = await openLookup(page, fieldPath);
  const row = modal.locator('.ag-center-cols-container .ag-row[row-index]', { hasText: text }).first();
  console.log(`${fieldPath} modal title:`, (await modal.locator('[class*="modal-title"]').first().textContent().catch(() => ''))?.trim(), 'rows:', await modal.locator('.ag-center-cols-container .ag-row[row-index]').count());
  await row.click();
  await page.waitForTimeout(400);
  await modal.getByRole('button', { name: '确认', exact: true }).last().click();
  await page.waitForTimeout(1000);
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

  await pickLookup(page, `${PREFIX}.ops_unit_no`, '000W1');
  await pickLookup(page, `${PREFIX}.biz_type_no`, BIZ);
  await selectOption(page, `${PREFIX}.verf_mode`, '整单');
  await page.waitForTimeout(800);

  const sw = page.locator(`label[for="${PREFIX}.cash_stlmt_flag"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('button[role="switch"]').first();
  console.log('cash switch disabled:', await sw.getAttribute('aria-disabled'), 'checked:', await sw.getAttribute('aria-checked'));
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
  await page.waitForTimeout(1200);
  console.log('after toggle:', await sw.getAttribute('aria-checked'));

  const cashModal = await openLookup(page, `${PREFIX}.cash_stlmt_biz_type_no`);
  console.log('cash modal title:', (await cashModal.locator('[class*="modal-title"]').first().textContent().catch(() => ''))?.trim());
  console.log('cash columns:', await cashModal.evaluate((el) => Array.from(el.querySelectorAll('.ag-header-cell')).map((c) => (c.textContent || '').trim()).filter(Boolean)));
  console.log('cash rows:', await cashModal.locator('.ag-center-cols-container .ag-row[row-index]').count());
  console.log('cash first rows:', await cashModal.evaluate((el) => Array.from(el.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).slice(0, 8).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])))));
  await cashModal.getByRole('button', { name: '取消', exact: true }).last().click();
  await page.waitForTimeout(600);

  await page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first().click().catch(() => undefined);
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
