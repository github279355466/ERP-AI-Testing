const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (candidate.url().includes('workItemCode=hoRpQwPEmnlK')) page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(800);
  const modal = page.locator('.rc-dialog-wrap:visible').last();
  const count = await modal.count();
  console.log('modal:', count);
  if (count === 0) {
    console.log('no modal; body:', (await page.evaluate(() => document.body.innerText)).slice(0, 300));
    process.exit(0);
  }
  const info = await modal.evaluate((el) => {
    const area = el.querySelector('[class*="ConditionArea"], [class*="MultiConditionFilter"]');
    return {
      areaHtml: area?.outerHTML.slice(0, 3000),
      selects: Array.from(el.querySelectorAll('[class*="Select-module_select"]')).slice(0, 4).map((s) => ({
        cls: String(s.className),
        text: (s.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        html: s.outerHTML.slice(0, 300),
      })),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
