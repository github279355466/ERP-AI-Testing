const { chromium } = require('@playwright/test');
const CODE = process.argv[2] || 'ARAT-01';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (p.url().includes('workItemCode=pPatSaneKVfy')) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(800);
  const calls = [];
  page.on('request', (req) => {
    if (req.method() !== 'GET' && req.method() !== 'OPTIONS') calls.push({ phase: 'req', method: req.method(), url: req.url().split('?')[0].slice(-90), body: (req.postData() || '').slice(0, 400) });
  });
  page.on('response', async (res) => {
    const req = res.request();
    if (req.method() !== 'GET' && req.method() !== 'OPTIONS') {
      let body = '';
      try { body = (await res.text()).slice(0, 500); } catch {}
      calls.push({ phase: 'res', status: res.status(), url: res.url().split('?')[0].slice(-90), body });
    }
  });

  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '删除' }).first().click();
  await page.waitForTimeout(900);
  await page.locator('.rc-dialog:visible').last().getByRole('button', { name: '确定', exact: true }).click();
  await page.waitForTimeout(3500);
  const messages = await page.evaluate(() => Array.from(document.querySelectorAll('[class*="message"], [class*="Message"], [role="alert"]')).filter((el) => el.offsetWidth > 0).map((el) => (el.textContent || '').trim()).filter(Boolean));
  console.log('messages:', JSON.stringify(messages));
  console.log('calls:', JSON.stringify(calls, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
