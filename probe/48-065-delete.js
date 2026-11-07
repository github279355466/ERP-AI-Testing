const { chromium } = require('@playwright/test');
const NO = 'T064-20261106-B1';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (candidate.url().includes('/list') && candidate.url().includes('workItemCode=hoRpQwPEmnlK')) page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();

  let index = -1;
  for (let i = 0; i < 50 && index < 0; i += 1) {
    index = await page.evaluate((target) => {
      const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
      const row = rows.find((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target);
      return row ? Number(row.getAttribute('row-index')) : -1;
    }, NO);
    if (index < 0) await page.waitForTimeout(300);
  }
  console.log('index:', index);
  console.log('rows:', await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((r) => ({
    i: r.getAttribute('row-index'),
    no: (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim(),
    year: (r.querySelector('.ag-cell[col-id="acctg_year"]')?.textContent || '').trim(),
    rmk: (r.querySelector('.ag-cell[col-id="rmk"]')?.textContent || '').trim(),
  }))));

  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '删除' }).first().click();
  await page.waitForTimeout(1000);
  console.log('dialog:', await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return Array.from(document.querySelectorAll('.rc-dialog')).filter(visible).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200))[0];
  }));

  await page.evaluate(() => {
    window.__toasts = [];
    new MutationObserver(() => {
      document.querySelectorAll('[class*="message"], [class*="Message"], [role="alert"]').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text && !window.__toasts.includes(text)) window.__toasts.push(text);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.locator('.rc-dialog:visible').last().getByRole('button', { name: '确定', exact: true }).click();
  await page.waitForTimeout(3000);
  console.log('toasts:', JSON.stringify(await page.evaluate(() => window.__toasts)));
  console.log('after:', JSON.stringify(await page.evaluate((target) => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    return {
      rows: rows.length,
      exists: rows.some((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target),
      footer: (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0],
    };
  }, NO), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
