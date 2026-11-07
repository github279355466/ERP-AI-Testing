const { chromium } = require('@playwright/test');
const TITLE = process.argv[2] || '应付业务单别';
const CODE = process.argv[3] || 'APAT-01';
const COLUMN = process.argv[4] || 'biz_type_no';
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

  const indexOf = async () => page.evaluate(({ value, column }) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector(`.ag-cell[col-id="${column}"]`)?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, { value: CODE, column: COLUMN });
  const statusOf = async () => page.evaluate(({ value, column }) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector(`.ag-cell[col-id="${column}"]`)?.textContent || '').trim() === value);
    if (!row) return 'MISSING';
    const rowId = row.getAttribute('row-id');
    const right = document.querySelector(`.ag-pinned-right-cols-container .ag-row[row-id="${rowId}"]`);
    return (right?.querySelector('.ag-cell[col-id="manage_status"]')?.textContent || '').trim();
  }, { value: CODE, column: COLUMN });
  const waitStatus = async (expected) => {
    for (let i = 0; i < 30; i += 1) {
      const value = await statusOf();
      if (value === expected || value === 'MISSING') return value;
      await page.waitForTimeout(300);
    }
    return statusOf();
  };
  const openMenu = async () => {
    await page.keyboard.press('Escape');
    await page.locator('.digi-dropdown-menu:visible').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => undefined);
    const index = await indexOf();
    await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first().click();
    await page.locator('.digi-dropdown-menu:visible').last().waitFor({ state: 'visible', timeout: 5000 });
  };
  const menuClick = async (text) => {
    const item = page.locator('.digi-dropdown-menu:visible .digi-dropdown-menu-item').filter({ hasText: new RegExp(`^${text}$`) }).last();
    await item.waitFor({ state: 'visible', timeout: 5000 });
    await item.click();
    await page.waitForTimeout(800);
  };
  const confirm = async () => {
    const dialog = page.locator('.rc-dialog:visible').last();
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const text = (await dialog.innerText()).replace(/\s+/g, ' ').trim();
    await dialog.getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForTimeout(1800);
    return text;
  };

  console.log('index:', await indexOf(), 'status:', await statusOf());
  await openMenu();
  await menuClick('失效');
  console.log('dialog:', await confirm());
  console.log('status after invalidate:', await waitStatus('失效'));

  await openMenu();
  await menuClick('删除');
  console.log('delete dialog:', await confirm());
  console.log('exists after delete:', await indexOf(), 'status:', await statusOf());
  console.log('tail:', (await page.evaluate(() => document.body.innerText)).slice(-120));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
