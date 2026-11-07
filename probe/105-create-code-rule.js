const { chromium } = require('@playwright/test');
const CODE = process.argv[2];
const DESC = process.argv[3] || CODE;
const TITLE = process.argv[4] || '批号编号规则';
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
  await page.waitForTimeout(1200);
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);
  const fill = async (path, value) => {
    const input = page.locator(`label[for="${path}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('input').first();
    await input.click();
    await input.fill('');
    await input.fill(value);
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
  };
  await fill('code_rule.code_rule_no', CODE);
  await fill('code_rule.code_rule_desc', DESC);
  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  console.log('tail:', (await page.evaluate(() => document.body.innerText)).slice(-120));
  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2500);
  console.log('row:', JSON.stringify(await page.evaluate((code) => {
    const r = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((x) => (x.querySelector('.ag-cell[col-id="code_rule_no"]')?.textContent || '').trim() === code);
    return r ? Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])) : null;
  }, CODE), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
