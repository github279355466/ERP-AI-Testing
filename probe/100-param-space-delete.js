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
  await page.waitForTimeout(1000);
  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  console.log('index:', index);
  const cell = page.locator(`.ag-center-cols-container .ag-row[row-index="${index}"] .ag-cell[col-id="biz_type_no"]`).first();
  await cell.click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.waitForTimeout(600);
  console.log('selected:', (await page.evaluate(() => document.body.innerText)).match(/已选\s*\d+\s*条/)?.[0]);
  const calls = [];
  page.on('request', (req) => { if (req.method() !== 'GET' && req.method() !== 'OPTIONS') calls.push({ m: req.method(), u: req.url().split('?')[0].slice(-90), b: (req.postData() || '').slice(0, 300) }); });
  page.on('response', async (res) => { if (res.request().method() !== 'GET' && res.request().method() !== 'OPTIONS') { let t = ''; try { t = (await res.text()).slice(0, 300); } catch {} calls.push({ s: res.status(), u: res.url().split('?')[0].slice(-90), b: t }); } });
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '删除' }).first().click();
  await page.waitForTimeout(900);
  await page.locator('.rc-dialog:visible').last().getByRole('button', { name: '确定', exact: true }).click();
  await page.waitForTimeout(3500);
  console.log('calls:', JSON.stringify(calls, null, 2));
  console.log('messages:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('[class*="message"], [role="alert"]')).filter((el) => el.offsetWidth > 0).map((el) => (el.textContent || '').trim()).filter(Boolean))));
  console.log('exists:', await page.evaluate((value) => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).some((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value), CODE));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
