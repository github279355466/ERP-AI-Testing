const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const CODE = process.argv[3];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === TITLE) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(1000);
  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first().click();
  await page.waitForTimeout(700);
  console.log(JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.digi-dropdown-menu .digi-dropdown-menu-item')).filter((el) => el.offsetWidth > 0).map((el) => ({
    text: (el.textContent || '').trim(),
    cls: String(el.className),
    ariaDisabled: el.getAttribute('aria-disabled'),
    pointerEvents: getComputedStyle(el).pointerEvents,
    opacity: getComputedStyle(el).opacity,
  }))), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
