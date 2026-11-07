const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if ((await p.title().catch(() => '')) === '采购取价策略') page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(3000);
  console.log('tail:', (await page.evaluate(() => document.body.innerText)).slice(-250));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
