const { chromium } = require('@playwright/test');
const TITLE = process.argv[2] || '应收业务单别参数';
const CODE = process.argv[3] || 'ARAT-01';
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
  await page.waitForTimeout(800);
  const index = await page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '查看' }).first().click();
  await page.waitForTimeout(2200);
  let detail = context.pages().find((p) => p.url().includes('/detail'));
  if (!detail || (await detail.title().catch(() => '')) !== TITLE) detail = page;
  await detail.bringToFront();
  await detail.waitForTimeout(800);
  console.log('tabs:', await detail.evaluate(() => Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim())));
  const del = detail.locator('button:visible', { hasText: '删除' }).first();
  console.log('detail delete count:', await del.count());
  await del.click();
  await detail.waitForTimeout(1000);
  const dlg = detail.locator('.rc-dialog:visible').last();
  console.log('dialog:', await dlg.count() ? (await dlg.innerText()).replace(/\s+/g, ' ').trim() : 'none');
  const ok = dlg.getByRole('button', { name: '确定', exact: true });
  if ((await ok.count()) > 0) await ok.click();
  await detail.waitForTimeout(3000);
  console.log('detail tail:', (await detail.evaluate(() => document.body.innerText)).slice(-150));
  if (detail !== page) await detail.close().catch(() => undefined);
  await page.bringToFront();
  await page.waitForTimeout(1500);
  console.log('exists:', await page.evaluate((value) => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).some((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value), CODE));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
