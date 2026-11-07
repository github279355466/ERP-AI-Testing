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

  const requests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (/acctg|lowcode|esp|api/i.test(url) && req.method() !== 'OPTIONS') {
      requests.push({ method: req.method(), url: url.split('?')[0], body: (req.postData() || '').slice(0, 400) });
    }
  });

  const item = page.locator('label[for="acctg_perid_info.begin_date"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  await item.locator('input').first().click();
  await page.waitForTimeout(700);
  const cell = page.locator('.digi-picker-dropdown:visible td[title="2027-01-01"]').first();
  console.log('cell count:', await cell.count());
  await cell.click();
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    return {
      begin: document.querySelector('label[for="acctg_perid_info.begin_date"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
      rows: rows.length,
      first: rows.slice(0, 2).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
      last: rows.slice(-2).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  console.log('requests:', JSON.stringify(requests.slice(-15), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
