const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const CODE = process.argv[3];
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
  page.on('request', (req) => { if (req.method() !== 'GET' && req.method() !== 'OPTIONS') calls.push({ m: req.method(), u: req.url().split('?')[0].slice(-90), b: (req.postData() || '').slice(0, 300) }); });
  page.on('response', async (res) => { if (res.request().method() !== 'GET' && res.request().method() !== 'OPTIONS') { let t = ''; try { t = (await res.text()).slice(0, 300); } catch {} calls.push({ s: res.status(), u: res.url().split('?')[0].slice(-90), b: t }); } });
  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first().click();
  await page.waitForTimeout(700);
  await page.locator('.digi-dropdown-menu .custom-op-menu-label').filter({ hasText: /^失效$/ }).last().click();
  await page.waitForTimeout(900);
  const clicked = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('.rc-dialog')).filter((el) => el.offsetWidth > 0);
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return false;
    const buttons = Array.from(dialog.querySelectorAll('button'));
    const ok = buttons.find((b) => (b.textContent || '').trim() === '确定');
    if (!ok) return false;
    ok.click();
    return true;
  });
  console.log('dom clicked:', clicked);
  await page.waitForTimeout(3500);
  console.log('calls:', JSON.stringify(calls, null, 2));
  console.log('messages:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('[class*="message"], [role="alert"]')).filter((el) => el.offsetWidth > 0).map((el) => (el.textContent || '').trim()).filter(Boolean))));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
