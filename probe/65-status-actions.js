const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
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
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.ag-pinned-right-cols-container .ag-row[row-index], .ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0 && r.querySelector('.ag-cell[col-id="operate"]')).map((r) => {
    const sw = r.querySelector('.ag-cell[col-id="manage_status"] button[role="switch"]');
    return {
      i: r.getAttribute('row-index'),
      no: (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim(),
      status: sw ? sw.getAttribute('aria-checked') : null,
      statusDisabled: sw ? sw.hasAttribute('disabled') : null,
      actions: Array.from(r.querySelectorAll('.custom-op-container:not(.custom-op-measure-container) > button')).map((b) => (b.textContent || '').trim()).filter(Boolean),
    };
  }));
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
