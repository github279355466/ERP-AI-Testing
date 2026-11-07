const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (candidate.url().includes('/list') && candidate.url().includes('workItemCode=hoRpQwPEmnlK')) page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1200);

  const trigger = page.locator('label[for="acctg_perid_info.acctg_perid_table_no"]:visible').first()
    .locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]')
    .locator('[class*="WindowSelect-module_windowSelect"]').first();
  const box = await trigger.boundingBox();
  await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
  await page.waitForTimeout(1200);
  const modal = page.locator('.rc-dialog-wrap:visible').last();
  await modal.locator('.ag-center-cols-container .ag-row[row-index]', { hasText: '12333' }).first().click();
  await page.waitForTimeout(400);
  await modal.getByRole('button', { name: '确认', exact: true }).last().click();
  await page.waitForTimeout(1200);

  const item = page.locator('label[for="acctg_perid_info.begin_date"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const input = item.locator('input').first();
  await input.click();
  await page.waitForTimeout(500);
  await input.fill('2027-01-01');
  await input.press('Enter');
  await page.waitForTimeout(1200);

  const before = await page.evaluate(() => document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length);
  console.log('rows before add-detail:', before);
  await page.locator('button:visible', { hasText: '新增单身明细' }).first().click();
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => ({
    rows: Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).length,
    first: Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).slice(0, 2).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
    body: (document.body.innerText || '').slice(-400),
  }));
  console.log(JSON.stringify(after, null, 2));

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
