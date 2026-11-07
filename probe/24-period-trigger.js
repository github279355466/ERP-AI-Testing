const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间表') page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();

  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1000);

  const item = page.locator('[class*="FormItem-module_form-item__"]').filter({
    has: page.locator('label[for="acctg_perid_table.insta_count"]'),
  });
  const input = item.locator('input').first();
  console.log('PARENT', (await input.evaluate((element) => element.parentElement?.outerHTML.slice(0, 1200))) || '');

  const count = async (label) => {
    const state = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
      const indexes = [...new Set(rows.map((row) => Number(row.getAttribute('row-index'))))].sort((a, b) => a - b);
      return { count: indexes.length, indexes };
    });
    console.log(label, JSON.stringify({ value: await input.inputValue().catch(() => ''), ...state }));
  };

  const nameLabel = page.locator('label[for="acctg_perid_table.acctg_perid_table_name"]');

  await input.click();
  await input.fill('13');
  await nameLabel.click();
  await page.waitForTimeout(1000);
  await count('13-BLUR-LABEL');

  await input.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('14');
  await nameLabel.click();
  await page.waitForTimeout(1000);
  await count('14-TYPE-BLUR-LABEL');

  await input.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('14');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await count('14-ENTER');

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
