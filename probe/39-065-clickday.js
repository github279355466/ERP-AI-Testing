const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间信息') page = candidate;
  }
  await page.bringToFront();

  const cell = page.locator('.digi-picker-dropdown:visible td[title="2027-01-01"]').first();
  console.log('cell count:', await cell.count());
  if ((await cell.count()) > 0) await cell.click();
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    return {
      begin: document.querySelector('label[for="acctg_perid_info.begin_date"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
      rows: rows.length,
      first: rows.slice(0, 3).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
      last: rows.slice(-3).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
      body: (document.body.innerText || '').slice(0, 700),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
