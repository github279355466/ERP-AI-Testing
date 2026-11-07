const { chromium } = require('@playwright/test');
const NO = 'T064-20261106-A1';

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

  let index = -1;
  for (let i = 0; i < 40 && index < 0; i += 1) {
    index = await page.evaluate((target) => {
      const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
      const row = rows.find((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target);
      return row ? Number(row.getAttribute('row-index')) : -1;
    }, NO);
    if (index < 0) await page.waitForTimeout(300);
  }
  console.log('row index:', index);

  await page.evaluate(() => {
    window.__toasts = [];
    new MutationObserver(() => {
      document.querySelectorAll('[class*="message"], [class*="Message"], [role="alert"]').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text && !window.__toasts.includes(text)) window.__toasts.push(text);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '删除' }).first().click();
  await page.waitForTimeout(1000);
  const dialog = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return Array.from(document.querySelectorAll('[class*="Modal-module"], [class*="Dialog-module"], [role="dialog"]'))
      .filter(visible)
      .map((el) => ({
        cls: String(el.className).slice(0, 120),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300),
        buttons: Array.from(el.querySelectorAll('button')).map((b) => (b.textContent || '').trim()).filter(Boolean),
      }));
  });
  console.log('dialog:', JSON.stringify(dialog, null, 2));

  const confirm = page.getByRole('button', { name: '确定', exact: true });
  console.log('confirm count:', await confirm.count());
  if ((await confirm.count()) > 0) await confirm.first().click();
  await page.waitForTimeout(3000);

  const result = await page.evaluate((target) => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    return {
      toasts: window.__toasts,
      rows: rows.length,
      exists: rows.some((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target),
      footer: (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0],
      body: (document.body.innerText || '').slice(0, 400),
    };
  }, NO);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
