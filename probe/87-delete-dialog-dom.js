const { chromium } = require('@playwright/test');
const CODE = process.argv[2] || 'ARAT-01';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (p.url().includes('workItemCode=pPatSaneKVfy')) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(800);
  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '删除' }).first().click();
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return Array.from(document.querySelectorAll('.rc-dialog')).filter(visible).map((el) => ({
      cls: String(el.className).slice(0, 80),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      buttons: Array.from(el.querySelectorAll('button')).map((b) => ({ text: (b.textContent || '').trim(), disabled: b.disabled, cls: String(b.className).slice(0, 60) })).filter((b) => b.text),
    }));
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
