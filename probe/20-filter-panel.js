const { chromium } = require('@playwright/test');

const TITLE = process.argv[2] || '会计期间表';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const business = [];
  for (const page of context.pages()) {
    if (!page.url().includes('lowcode-form-render')) continue;
    business.push({ page, title: await page.title().catch(() => '') });
  }
  const target = business.find((item) => item.title === TITLE);
  if (!target) throw new Error(`page not found: ${TITLE}`);
  const page = target.page;
  await page.bringToFront();

  const filter = page.locator('button:visible', { hasText: '筛选' }).first();
  if ((await filter.count()) === 0) throw new Error('筛选 button not found');
  await filter.click();
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => {
    const visible = (element) => (element.offsetWidth || 0) > 0;
    const controls = Array.from(
      document.querySelectorAll('input, textarea, button, [class*="Select-module_select__"], [class*="WindowSelect-module_windowSelect"]'),
    )
      .filter(visible)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        cls: String(element.className).slice(0, 120),
        text: (element.textContent || '').trim().slice(0, 60),
        value: 'value' in element ? element.value : '',
        placeholder: element.getAttribute('placeholder'),
        ariaLabel: element.getAttribute('aria-label'),
        name: element.getAttribute('name'),
      }))
      .slice(0, 80);
    const labels = Array.from(document.querySelectorAll('label'))
      .filter(visible)
      .map((label) => ({ text: (label.textContent || '').trim(), for: label.getAttribute('for') }))
      .filter((item) => item.text)
      .slice(0, 40);
    const panels = Array.from(document.querySelectorAll('[class*="Condition"],[class*="Filter"],[class*="filter"],[class*="condition"]'))
      .filter(visible)
      .slice(0, 10)
      .map((element) => ({ cls: String(element.className).slice(0, 120), text: (element.innerText || '').trim().slice(0, 200) }));
    return {
      bodyText: (document.body.innerText || '').trim().slice(0, 800),
      controls,
      labels,
      panels,
    };
  });
  console.log(JSON.stringify(state, null, 2));

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
