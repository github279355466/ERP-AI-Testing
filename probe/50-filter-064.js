const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (candidate.url().includes('/list') && candidate.url().includes('workItemCode=cEBGcJzbDWkQ')) page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(1000);

  await page.locator('button:visible', { hasText: '筛选' }).first().click();
  await page.waitForTimeout(700);
  const root = page.locator('[class*="MultiConditionFilter-module_popover-content"]').first();
  console.log('root count:', await root.count());

  await root.locator('[class*="ConditionRow-module_row-field"] .ath-select').first().click();
  await page.waitForTimeout(600);
  const options = await page.evaluate(() => Array.from(document.querySelectorAll('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option'))
    .filter((el) => el.offsetWidth > 0)
    .map((el) => (el.textContent || '').trim()).filter(Boolean));
  console.log('options:', JSON.stringify(options));

  await page.locator('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option', { hasText: '会计期间表编号' }).first().click();
  await page.waitForTimeout(500);
  const valueInput = root.locator('input[placeholder="请输入值"]').first();
  console.log('value disabled:', await valueInput.isDisabled());
  await valueInput.click();
  await valueInput.fill('T064');
  await page.waitForTimeout(300);

  const buttons = await root.locator('button').allInnerTexts();
  console.log('buttons:', JSON.stringify(buttons));
  await root.locator('button', { hasText: '筛选' }).last().click();
  await page.waitForTimeout(2500);

  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).map((r) => ({
    i: r.getAttribute('row-index'),
    no: (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim(),
  })));
  console.log('rows after filter:', JSON.stringify(rows));
  console.log('footer:', await page.evaluate(() => (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0]));

  await page.locator('button:visible', { hasText: '筛选' }).first().click();
  await page.waitForTimeout(700);
  const root2 = page.locator('[class*="MultiConditionFilter-module_popover-content"]').first();
  await root2.locator('button', { hasText: '清空' }).last().click();
  await page.waitForTimeout(400);
  await root2.locator('button', { hasText: '筛选' }).last().click();
  await page.waitForTimeout(2500);
  console.log('rows after clear:', await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).length));
  console.log('footer after clear:', await page.evaluate(() => (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0]));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
