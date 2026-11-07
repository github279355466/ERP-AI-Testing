const { chromium } = require('@playwright/test');
const NO = 'T064-20261106-B1';
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间信息') page = candidate;
  }
  await page.bringToFront();
  const trigger = page.locator('label[for="acctg_perid_info.acctg_perid_table_no"]:visible').first()
    .locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]')
    .locator('[class*="WindowSelect-module_windowSelect"]').first();
  const box = await trigger.boundingBox();
  await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
  await page.waitForTimeout(1200);
  const modal = page.locator('.rc-dialog-wrap:visible').last();
  console.log('modal count:', await modal.count());
  const row = modal.locator('.ag-center-cols-container .ag-row[row-index]').filter({ hasText: NO }).first();
  console.log('row count:', await row.count());
  await row.click();
  await page.waitForTimeout(400);
  await modal.getByRole('button', { name: '确认', exact: true }).last().click();
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    return {
      begin: document.querySelector('label[for="acctg_perid_info.begin_date"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
      insta: document.querySelector('label[for="acctg_perid_info.insta_count"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
      rows: rows.length,
      first: rows.slice(0, 2).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
      last: rows.slice(-2).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
      body: (document.body.innerText || '').slice(-500),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
