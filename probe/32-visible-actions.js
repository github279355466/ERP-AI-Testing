const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间表') page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  const info = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button.custom-op-text-btn')).filter((b) => (b.textContent || '').trim() === '编辑').map((b) => {
      const r = b.getBoundingClientRect();
      const row = b.closest('.ag-row');
      return {
        visible: b.offsetWidth > 0 && b.offsetHeight > 0,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        rowIndex: row?.getAttribute('row-index'),
        rowCls: String(row?.className).slice(0, 80),
        parentCls: String(b.parentElement?.className),
        grandCls: String(b.parentElement?.parentElement?.className),
        cellCls: String(b.closest('.ag-cell')?.className).slice(0, 120),
      };
    });
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
