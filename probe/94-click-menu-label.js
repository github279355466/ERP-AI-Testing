const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const CODE = process.argv[3];
const ACTION = process.argv[4] || '失效';
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
  const calls = [];
  page.on('request', (req) => { if (req.method() !== 'GET' && req.method() !== 'OPTIONS') calls.push({ p: 'req', m: req.method(), u: req.url().split('?')[0].slice(-90), b: (req.postData() || '').slice(0, 300) }); });
  page.on('response', async (res) => { if (res.request().method() !== 'GET' && res.request().method() !== 'OPTIONS') { let t = ''; try { t = (await res.text()).slice(0, 300); } catch {} calls.push({ p: 'res', s: res.status(), u: res.url().split('?')[0].slice(-90), b: t }); } });
  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first().click();
  await page.waitForTimeout(700);
  const label = page.locator('.digi-dropdown-menu .custom-op-menu-label').filter({ hasText: new RegExp(`^${ACTION}$`) }).last();
  console.log('label count:', await label.count(), 'visible:', await label.isVisible().catch(() => false));
  await label.click();
  await page.waitForTimeout(900);
  const dlg = page.locator('.rc-dialog:visible').last();
  console.log('dialog:', await dlg.count() ? (await dlg.innerText()).replace(/\s+/g, ' ').trim() : 'none');
  if ((await dlg.count()) > 0) await dlg.getByRole('button', { name: '确定', exact: true }).click();
  await page.waitForTimeout(3500);
  console.log('calls:', JSON.stringify(calls, null, 2));
  console.log('messages:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('[class*="message"], [role="alert"]')).filter((el) => el.offsetWidth > 0).map((el) => (el.textContent || '').trim()).filter(Boolean))));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
