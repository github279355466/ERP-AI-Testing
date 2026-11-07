const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (candidate.url().includes('workItemCode=hoRpQwPEmnlK')) page = candidate;
  }
  await page.bringToFront();
  const modal = page.locator('.rc-dialog-wrap:visible').last();
  const inputs = await modal.evaluate((el) => Array.from(el.querySelectorAll('input')).map((i) => ({
    type: i.type, placeholder: i.placeholder, value: i.value, disabled: i.disabled, cls: String(i.className).slice(0, 80), visible: i.offsetWidth > 0,
  })));
  console.log('inputs:', JSON.stringify(inputs, null, 2));

  const value = modal.locator('input[placeholder="请输入值"]').first();
  console.log('value count:', await value.count(), 'disabled:', await value.isDisabled().catch(() => null));
  await value.click();
  await value.fill('T064-13-4Q8TJA');
  await page.waitForTimeout(500);
  console.log('value now:', await value.inputValue());
  const filter = modal.locator('button', { hasText: '筛选' }).last();
  console.log('filter count:', await modal.locator('button', { hasText: '筛选' }).count());
  await filter.click();
  await page.waitForTimeout(2000);
  console.log('rows:', await modal.evaluate((el) => Array.from(el.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((r) => ({
    i: r.getAttribute('row-index'),
    no: (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim(),
  }))));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
