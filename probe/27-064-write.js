const { chromium } = require('@playwright/test');

const NO = 'T064-20261106-A1';
const NAME = '自动化测试-12期-A1';

async function findPage(title) {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === title) return candidate;
  }
  throw new Error(`page not found: ${title}`);
}

async function state(page, label) {
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'))
      .filter(visible)
      .map((row) => ({
        index: row.getAttribute('row-index'),
        cells: Object.fromEntries(Array.from(row.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
      }));
    return {
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').replace(/[\s]+/g, ' ').trim()),
      hovered: document.activeElement ? (document.activeElement.getAttribute('id') || document.activeElement.tagName) : null,
      save: Array.from(document.querySelectorAll('button')).filter((b) => visible(b) && (b.textContent || '').trim() === '保存').map((b) => ({ disabled: b.disabled, cls: String(b.className) })),
      gridRows: rows.length,
      rows: rows.slice(0, 20),
      message: Array.from(document.querySelectorAll('[class*="message"], [class*="Message"], [class*="toast"], [class*="Toast"], [role="alert"]')).filter(visible).map((el) => (el.textContent || '').trim()).filter(Boolean).slice(0, 5),
      dialog: Array.from(document.querySelectorAll('[class*="Modal-module"], [class*="Dialog-module"], [role="dialog"]')).filter(visible).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300)).slice(0, 3),
    };
  });
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(info, null, 2));
  return info;
}

async function fill(page, fieldPath, value) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const input = item.locator('input').first();
  await input.click();
  await input.fill('');
  await input.fill(value);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(600);
}

async function listRows(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((row) => ({
    index: row.getAttribute('row-index'),
    cells: Object.fromEntries(Array.from(row.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
  })));
}

(async () => {
  const page = await findPage('会计期间表');
  await page.bringToFront();
  await state(page, 'list-before');

  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1200);
  await state(page, 'new-open');

  await fill(page, 'acctg_perid_table.acctg_perid_table_no', NO);
  await fill(page, 'acctg_perid_table.acctg_perid_table_name', NAME);
  await fill(page, 'acctg_perid_table.insta_count', '12');
  await fill(page, 'acctg_perid_table.rmk', '自动化写入测试-待删除');
  await state(page, 'new-filled');

  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  await state(page, 'after-save');

  const rows = await listRows(page);
  const target = rows.find((row) => row.cells.acctg_perid_table_no === NO);
  console.log('created row:', JSON.stringify(target, null, 2));
  console.log('footer:', await page.evaluate(() => (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0]));

  if (target) {
    const row = page.locator(`.ag-center-cols-container .ag-row[row-index="${target.index}"]`).first();
    await row.locator('button', { hasText: '查看' }).first().click();
    await page.waitForTimeout(1200);
    await state(page, 'view-created');

    await page.locator('button:visible', { hasText: '编辑' }).first().click();
    await page.waitForTimeout(1000);
    await state(page, 'edit-open');

    await fill(page, 'acctg_perid_table.rmk', '自动化写入测试-已编辑');
    await page.locator('button:visible', { hasText: '保存' }).first().click();
    await page.waitForTimeout(2500);
    await state(page, 'after-edit-save');
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
