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
  console.log(
    'ATTRS',
    JSON.stringify(
      await input.evaluate((element) => ({
        value: element.value,
        min: element.getAttribute('min'),
        max: element.getAttribute('max'),
        step: element.getAttribute('step'),
        cls: element.className,
      })),
    ),
  );

  const snapshot = async (label) => {
    const state = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(
        (row) => row.offsetWidth > 0,
      );
      const last = rows[rows.length - 1];
      return {
        count: rows.length,
        lastHtml: last ? last.innerHTML.slice(0, 1200) : null,
      };
    });
    const value = await input.inputValue().catch(() => '');
    console.log(label, JSON.stringify({ inputValue: value, ...state }, null, 2));
  };

  await input.click();
  await input.fill('13');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1200);
  await snapshot('AFTER-13');

  await input.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('14');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1200);
  await snapshot('AFTER-14-TYPE');

  await input.click();
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(1200);
  await snapshot('AFTER-ARROWUP');

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
