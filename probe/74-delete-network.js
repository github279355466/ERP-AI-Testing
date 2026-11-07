const { chromium } = require('@playwright/test');
const CODE = process.argv[2] || 'APAT-01';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (p.url().includes('workItemCode=pYIaGDZuhRRK')) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(800);

  const calls = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET' && req.method() !== 'OPTIONS') {
      calls.push({ phase: 'request', method: req.method(), url: req.url().split('?')[0].slice(-100), body: (req.postData() || '').slice(0, 500) });
    }
  });
  page.on('response', async (res) => {
    const req = res.request();
    if (req.method() !== 'GET' && req.method() !== 'OPTIONS') {
      let body = '';
      try { body = (await res.text()).slice(0, 600); } catch {}
      calls.push({ phase: 'response', status: res.status(), url: res.url().split('?')[0].slice(-100), body });
    }
  });

  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first().click();
  await page.waitForTimeout(600);
  await page.locator('.digi-dropdown-menu:visible .digi-dropdown-menu-item').filter({ hasText: /^删除$/ }).last().click();
  await page.waitForTimeout(800);
  await page.locator('.rc-dialog:visible').last().getByRole('button', { name: '确定', exact: true }).click();
  await page.waitForTimeout(3500);
  console.log(JSON.stringify(calls, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
