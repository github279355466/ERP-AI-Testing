const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const COL = process.argv[3];
const VAL = process.argv[4];
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
  console.log(JSON.stringify(await page.evaluate(({ col, val }) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector(`.ag-cell[col-id="${col}"]`)?.textContent || '').trim() === val);
    if (!row) return null;
    const rowId = row.getAttribute('row-id');
    const right = document.querySelector(`.ag-pinned-right-cols-container .ag-row[row-id="${rowId}"]`);
    return {
      i: row.getAttribute('row-index'),
      cells: Object.fromEntries(Array.from(row.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
      right: Array.from(right?.querySelectorAll('.ag-cell[col-id]') ?? []).map((c) => ({ colId: c.getAttribute('col-id'), text: (c.textContent || '').trim() })),
      buttons: Array.from(right?.querySelectorAll('.custom-op-container:not(.custom-op-measure-container) > button') ?? []).map((b) => (b.textContent || '').trim()).filter(Boolean),
    };
  }, { col: COL, val: VAL }), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
