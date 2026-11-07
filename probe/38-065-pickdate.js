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

  const beginItem = page.locator('label[for="acctg_perid_info.begin_date"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const beginInput = beginItem.locator('input').first();
  await beginInput.click();
  await page.waitForTimeout(800);

  const panel = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const candidates = Array.from(document.querySelectorAll('div')).filter((el) => visible(el) && /picker-dropdown|picker-panel|calendar/i.test(String(el.className)));
    return candidates.slice(0, 4).map((el) => ({
      cls: String(el.className),
      html: el.outerHTML.slice(0, 1200),
      cells: Array.from(el.querySelectorAll('td, [title]')).slice(0, 12).map((c) => ({ tag: c.tagName, title: c.getAttribute('title'), text: (c.textContent || '').trim() })),
    }));
  });
  console.log(JSON.stringify(panel, null, 2));

  const cell = page.locator('.ath-picker-dropdown:visible td[title="2026-11-02"], .ath-picker-dropdown:visible [title="2026-11-02"]').first();
  console.log('cell count:', await cell.count());
  if ((await cell.count()) > 0) {
    await cell.click();
  } else {
    const alt = page.locator('[class*="picker-dropdown"]:visible td', { hasText: /^2$/ }).first();
    console.log('alt count:', await alt.count());
    if ((await alt.count()) > 0) await alt.click();
  }
  await page.waitForTimeout(2000);

  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    return {
      begin: document.querySelector('label[for="acctg_perid_info.begin_date"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
      rows: rows.length,
      first: rows.slice(0, 2).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
      last: rows.slice(-2).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
      body: (document.body.innerText || '').slice(0, 900),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
