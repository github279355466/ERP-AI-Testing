const { chromium } = require('@playwright/test');
const CODE = process.argv[2] || 'ARAT-01';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === (process.argv[3] || '应收业务单别参数')) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(800);
  const info = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    if (!row) return null;
    const rowId = row.getAttribute('row-id');
    const right = document.querySelector(`.ag-pinned-right-cols-container .ag-row[row-id="${rowId}"]`);
    return Array.from(right?.querySelectorAll('button') ?? []).map((b) => {
      const r = b.getBoundingClientRect();
      return { text: (b.textContent || '').trim(), cls: String(b.className).slice(0, 40), visible: b.offsetWidth > 0, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) } };
    });
  }, CODE);
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
