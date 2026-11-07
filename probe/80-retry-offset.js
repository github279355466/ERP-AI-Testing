const { chromium } = require('@playwright/test');
const OFFSET = process.argv[2] || 'AR0101';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (p.url().includes('workItemCode=pPatSaneKVfy')) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(500);

  const dialog = page.locator('.rc-dialog:visible').last();
  if ((await dialog.count()) > 0) {
    const cancel = dialog.getByRole('button', { name: '取消', exact: true });
    if ((await cancel.count()) > 0) await cancel.last().click().catch(() => undefined);
    await page.waitForTimeout(600);
  }

  const item = page.locator('label[for="biz_type_ar_param.insta_offst_adv_biz_type_no"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const box = await item.locator('[class*="WindowSelect-module_windowSelect"]').first().boundingBox();
  await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
  await page.waitForTimeout(1000);
  const modal = page.locator('.rc-dialog-wrap:visible').last();
  const row = modal.locator('.ag-center-cols-container .ag-row[row-index]').filter({ hasText: OFFSET }).first();
  console.log('rows:', await modal.locator('.ag-center-cols-container .ag-row[row-index]').count(), 'target:', await row.count());
  await row.click();
  await page.waitForTimeout(300);
  await modal.getByRole('button', { name: '确认', exact: true }).last().click();
  await page.waitForTimeout(800);

  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(3000);
  console.log('tail:', (await page.evaluate(() => document.body.innerText)).slice(-350));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
