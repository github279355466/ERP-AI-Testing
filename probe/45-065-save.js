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

  await page.evaluate(() => {
    window.__toasts = [];
    new MutationObserver(() => {
      document.querySelectorAll('[class*="message"], [class*="Message"], [role="alert"]').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text && !window.__toasts.includes(text)) window.__toasts.push(text);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  const rmkItem = page.locator('label[for="acctg_perid_info.rmk"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const rmkInput = rmkItem.locator('input').first();
  await rmkInput.click();
  await rmkInput.fill('自动化写入测试-065-待删除');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);

  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(3000);
  console.log('toasts:', JSON.stringify(await page.evaluate(() => window.__toasts)));
  console.log('tabs after save:', await page.evaluate(() => Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim())));

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  console.log('discard:', await discard.count());
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2500);

  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((row) => ({
    index: row.getAttribute('row-index'),
    cells: Object.fromEntries(Array.from(row.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
  })));
  console.log('footer:', await page.evaluate(() => (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0]));
  console.log(JSON.stringify(rows.filter((r) => (r.cells.acctg_perid_table_no || '').includes(NO)), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
