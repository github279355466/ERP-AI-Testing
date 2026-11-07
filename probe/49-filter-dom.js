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
  await page.locator('button:visible', { hasText: '筛选' }).first().click();
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const pop = Array.from(document.querySelectorAll('[class*="Filter-module_popover"], [class*="MultiConditionFilter"], [class*="Popover"]')).filter(visible);
    const root = pop[pop.length - 1];
    return {
      found: pop.length,
      cls: root ? String(root.className) : null,
      html: root ? root.outerHTML.slice(0, 5000) : null,
      text: root ? (root.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400) : null,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
