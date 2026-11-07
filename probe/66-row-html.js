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
  const info = await page.evaluate((no) => {
    const center = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === no);
    if (!center) return null;
    const rowId = center.getAttribute('row-id');
    const all = Array.from(document.querySelectorAll('.ag-row[row-id="' + rowId + '"]'));
    return all.map((r) => ({
      cls: String(r.className).slice(0, 120),
      cells: Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => ({
        colId: c.getAttribute('col-id'),
        text: (c.textContent || '').trim(),
        html: c.innerHTML.slice(0, 500),
      })),
    }));
  }, NO);
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
