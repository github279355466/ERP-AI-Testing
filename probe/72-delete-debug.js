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
  await page.waitForTimeout(1000);
  const events = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (/delete|remove|biz_type/i.test(url)) {
      let body = '';
      try { body = (await res.text()).slice(0, 500); } catch {}
      events.push({ status: res.status(), url: url.split('?')[0].slice(-120), body });
    }
  });

  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first().click();
  await page.waitForTimeout(600);
  await page.locator('.digi-dropdown-menu:visible .digi-dropdown-menu-item').filter({ hasText: /^删除$/ }).last().click();
  await page.waitForTimeout(1000);
  await page.locator('.rc-dialog:visible').last().getByRole('button', { name: '确定', exact: true }).click();
  await page.waitForTimeout(3000);
  console.log('events:', JSON.stringify(events, null, 2));
  console.log('body tail:', (await page.evaluate(() => document.body.innerText)).slice(-500));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
