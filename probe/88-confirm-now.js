const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (p.url().includes('workItemCode=pPatSaneKVfy')) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  const calls = [];
  page.on('request', (req) => { if (req.method() !== 'GET') calls.push({ m: req.method(), u: req.url().split('?')[0].slice(-80), b: (req.postData() || '').slice(0, 300) }); });
  page.on('response', async (res) => { if (res.request().method() !== 'GET') { let t = ''; try { t = (await res.text()).slice(0, 400); } catch {} calls.push({ s: res.status(), u: res.url().split('?')[0].slice(-80), b: t }); } });
  const dialog = page.locator('.rc-dialog:visible').last();
  console.log('dialog count:', await dialog.count());
  const ok = dialog.getByRole('button', { name: '确定', exact: true });
  console.log('ok count:', await ok.count(), 'visible:', await ok.isVisible().catch(() => false));
  await ok.click();
  await page.waitForTimeout(5000);
  console.log('calls:', JSON.stringify(calls, null, 2));
  console.log('messages:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('[class*="message"], [class*="Message"], [role="alert"]')).filter((el) => el.offsetWidth > 0).map((el) => (el.textContent || '').trim()).filter(Boolean))));
  console.log('exists:', await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).some((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === 'ARAT-01')));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
