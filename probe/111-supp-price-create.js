const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === '供应商品号价格') page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(1000);
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);
  const openLookup = async (path) => {
    const item = page.locator(`label[for="${path}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
    const box = await item.locator('[class*="WindowSelect-module_windowSelect"]').first().boundingBox();
    await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
    await page.waitForTimeout(1000);
    return page.locator('.rc-dialog-wrap:visible').last();
  };
  const pickFirst = async (path) => {
    const modal = await openLookup(path);
    const rows = modal.locator('.ag-center-cols-container .ag-row[row-index]');
    console.log(path, 'rows:', await rows.count());
    const first = rows.first();
    console.log('first:', (await first.textContent() || '').replace(/\s+/g, ' ').trim().slice(0, 80));
    await first.click();
    await page.waitForTimeout(300);
    await modal.getByRole('button', { name: '确认', exact: true }).last().click();
    await page.waitForTimeout(800);
  };
  await pickFirst('supp_item_price.ops_unit_no');
  await pickFirst('supp_item_price.supp_no');
  await pickFirst('supp_item_price.item_no');
  await pickFirst('supp_item_price.ccy_no');
  const fill = async (path, value) => {
    const input = page.locator(`label[for="${path}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('input').first();
    await input.click(); await input.fill(''); await input.fill(value); await page.keyboard.press('Tab'); await page.waitForTimeout(400);
  };
  await fill('supp_item_price.price', '100');
  await page.waitForTimeout(500);
  console.log('form tail:', (await page.evaluate(() => document.body.innerText)).slice(0, 900));
  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(3000);
  console.log('after save:', (await page.evaluate(() => document.body.innerText)).slice(-300));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
