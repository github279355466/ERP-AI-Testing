const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const FIELDS = process.argv.slice(3);
if (!TITLE || FIELDS.length === 0) { console.error('usage: node probe/62-options.js <title> <fieldPath...>'); process.exit(1); }

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === TITLE) page = p;
  }
  if (!page) throw new Error(`page not found: ${TITLE}`);
  await page.bringToFront();
  await page.waitForTimeout(1000);
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);

  for (const fieldPath of FIELDS) {
    const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
    const select = item.locator('.ath-select').first();
    console.log(`--- ${fieldPath} ---`);
    console.log('select count:', await select.count());
    if ((await select.count()) === 0) continue;
    await select.click();
    await page.waitForTimeout(600);
    const options = await page.evaluate(() => Array.from(document.querySelectorAll('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option'))
      .filter((el) => el.offsetWidth > 0)
      .map((el) => (el.textContent || '').trim()).filter(Boolean));
    console.log('options:', JSON.stringify(options));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
