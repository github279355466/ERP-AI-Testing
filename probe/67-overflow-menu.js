const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const NO = process.argv[3];
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
  const index = await page.evaluate((no) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === no);
    return row ? row.getAttribute('row-index') : null;
  }, NO);
  console.log('index:', index);
  const more = page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first();
  console.log('more count:', await more.count());
  await more.click();
  await page.waitForTimeout(700);
  const menu = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return Array.from(document.querySelectorAll('[class*="dropdown"], [class*="Dropdown"], [class*="menu"], [class*="Menu"]')).filter(visible).map((el) => ({
      cls: String(el.className).slice(0, 80),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      items: Array.from(el.querySelectorAll('button, li, [role="menuitem"]')).map((b) => (b.textContent || '').trim()).filter(Boolean).slice(0, 10),
    })).filter((x) => x.text);
  });
  console.log(JSON.stringify(menu, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
