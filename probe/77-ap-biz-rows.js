const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (p.url().includes('workItemCode=AyJIheXVzjAK')) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 关闭可能存在的详情页签
  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) {
    await close.click().catch(() => undefined);
    await page.waitForTimeout(400);
    const discard = page.getByRole('button', { name: '直接离开', exact: true });
    if ((await discard.count()) > 0) await discard.first().click();
    await page.waitForTimeout(800);
  }

  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);

  const open = async (path) => {
    const item = page.locator(`label[for="${path}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
    const box = await item.locator('[class*="WindowSelect-module_windowSelect"]').first().boundingBox();
    await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
    await page.waitForTimeout(1200);
    return page.locator('.rc-dialog-wrap:visible').last();
  };
  const ops = await open('biz_type_ap_param.ops_unit_no');
  await ops.locator('.ag-center-cols-container .ag-row[row-index]', { hasText: '000W1' }).first().click();
  await page.waitForTimeout(300);
  await ops.getByRole('button', { name: '确认', exact: true }).last().click();
  await page.waitForTimeout(800);

  const biz = await open('biz_type_ap_param.biz_type_no');
  console.log('title:', (await biz.locator('[class*="modal-title"]').first().textContent().catch(() => ''))?.trim());
  console.log('rows:', JSON.stringify(await biz.evaluate((el) => Array.from(el.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])))), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
