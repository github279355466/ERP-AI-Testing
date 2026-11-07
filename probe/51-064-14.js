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
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1200);

  const fill = async (path, value) => {
    const item = page.locator(`label[for="${path}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
    const input = item.locator('input').first();
    await input.click(); await input.fill(''); await input.fill(value); await page.keyboard.press('Tab'); await page.waitForTimeout(700);
  };
  await fill('acctg_perid_table.acctg_perid_table_no', 'T064-14-TEST');
  await fill('acctg_perid_table.acctg_perid_table_name', '14期探针');
  await fill('acctg_perid_table.insta_count', '14');

  console.log(JSON.stringify(await page.evaluate(() => {
    const input = document.querySelector('input.input-number-input');
    return {
      value: input?.value,
      min: input?.getAttribute('aria-valuemin'),
      max: input?.getAttribute('aria-valuemax'),
      rows: Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).length,
      body: (document.body.innerText || '').slice(-300),
    };
  }), null, 2));

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
