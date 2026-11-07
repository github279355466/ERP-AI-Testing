const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (p.url().includes('workItemCode=') && (await p.title().catch(() => '')) === '采购取价策略') page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(1000);
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);
  const fill = async (path, value) => {
    const input = page.locator(`label[for="${path}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('input').first();
    await input.click(); await input.fill(''); await input.fill(value); await page.keyboard.press('Tab'); await page.waitForTimeout(400);
  };
  await fill('pur_price_strtg.price_strtg_no', 'PS-T1');
  await fill('pur_price_strtg.price_strtg_name', '自动化取价策略1');
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1000);
  console.log('rows:', await page.evaluate(() => document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length));
  const cell = page.locator('.ag-center-cols-container .ag-row[row-index="0"] .ag-cell[col-id="pri"]').first();
  await cell.click();
  await page.waitForTimeout(700);
  console.log('pri html:', (await cell.innerHTML()).slice(0, 600));
  const priceCell = page.locator('.ag-center-cols-container .ag-row[row-index="0"] .ag-cell[col-id="price_type"]').first();
  await priceCell.click();
  await page.waitForTimeout(700);
  console.log('price html:', (await priceCell.innerHTML()).slice(0, 600));
  console.log('dropdown options:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option')).filter((el) => el.offsetWidth > 0).map((el) => (el.textContent || '').trim()))));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
