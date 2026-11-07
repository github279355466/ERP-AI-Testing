const { chromium } = require('@playwright/test');
const CODE = process.argv[2];
const DESC = process.argv[3];
const TITLE = '批号编号规则';
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

  const indexOf = async () => page.evaluate((code) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="code_rule_no"]')?.textContent || '').trim() === code);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, CODE);
  const statusOf = async () => page.evaluate((code) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="code_rule_no"]')?.textContent || '').trim() === code);
    if (!row) return 'MISSING';
    const right = document.querySelector(`.ag-pinned-right-cols-container .ag-row[row-id="${row.getAttribute('row-id')}"]`);
    return (right?.querySelector('.ag-cell[col-id="manage_status"]')?.textContent || '').trim();
  }, CODE);
  const waitStatus = async (expected) => {
    for (let i = 0; i < 30; i += 1) {
      const value = await statusOf();
      if (value === expected || value === 'MISSING') return value;
      await page.waitForTimeout(300);
    }
    return statusOf();
  };
  const confirm = async () => {
    const dlg = page.locator('.rc-dialog:visible').last();
    if ((await dlg.count()) === 0) return '';
    const text = (await dlg.innerText()).replace(/\s+/g, ' ').trim();
    await dlg.getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForTimeout(2200);
    return text;
  };
  const direct = async (text) => {
    const index = await indexOf();
    await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: text }).first().click();
    await page.waitForTimeout(900);
    return confirm();
  };
  const menu = async (text) => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const index = await indexOf();
    await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first().click();
    await page.locator('.digi-dropdown-menu:visible').last().waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.digi-dropdown-menu:visible .digi-dropdown-menu-item').filter({ hasText: new RegExp(`^${text}$`) }).last().click();
    await page.waitForTimeout(900);
    return confirm();
  };

  // 新增
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);
  const fill = async (path, value) => {
    const input = page.locator(`label[for="${path}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('input').first();
    await input.click(); await input.fill(''); await input.fill(value); await page.keyboard.press('Tab'); await page.waitForTimeout(400);
  };
  await fill('code_rule.code_rule_no', CODE);
  await fill('code_rule.code_rule_desc', DESC);
  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  console.log('create tail:', (await page.evaluate(() => document.body.innerText)).slice(-80));
  let close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  let discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2500);
  console.log('after create status:', await waitStatus('生效'));

  // 编辑
  let index = await indexOf();
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '编辑' }).first().click();
  await page.waitForTimeout(1800);
  await fill('code_rule.code_rule_desc', `${DESC}-改`);
  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2500);
  console.log('after edit:', await page.evaluate((code) => {
    const r = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((x) => (x.querySelector('.ag-cell[col-id="code_rule_no"]')?.textContent || '').trim() === code);
    return r ? (r.querySelector('.ag-cell[col-id="code_rule_desc"]')?.textContent || '').trim() : null;
  }, CODE));

  // 失效 / 生效 / 失效 / 删除
  console.log('invalidate dialog:', await menu('失效'));
  console.log('status:', await waitStatus('失效'));
  console.log('activate dialog:', await direct('生效'));
  console.log('status:', await waitStatus('生效'));
  console.log('invalidate2 dialog:', await menu('失效'));
  console.log('status:', await waitStatus('失效'));
  console.log('delete dialog:', await direct('删除'));
  console.log('exists:', await indexOf(), 'status:', await statusOf());
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
