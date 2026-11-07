const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const CODE = process.argv[3];
if (!TITLE || !CODE) { console.error('usage: node probe/69-status-delete.js <title> <code>'); process.exit(1); }

async function rowIndex(page, code) {
  return page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, code);
}

async function waitRow(page, code) {
  for (let i = 0; i < 40; i += 1) {
    const index = await rowIndex(page, code);
    if (index >= 0) return index;
    await page.waitForTimeout(300);
  }
  return -1;
}

async function rowInfo(page, code) {
  return page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    if (!row) return null;
    const rowId = row.getAttribute('row-id');
    const right = document.querySelector(`.ag-pinned-right-cols-container .ag-row[row-id="${rowId}"]`) || document.querySelector(`.ag-row[row-id="${rowId}"] .ag-cell[col-id="operate"]`)?.closest('.ag-row');
    return {
      i: row.getAttribute('row-index'),
      cells: Object.fromEntries(Array.from(row.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
      status: (right?.querySelector('.ag-cell[col-id="manage_status"]')?.textContent || '').trim(),
    };
  }, code);
}

async function menuAction(page, index, text) {
  const more = page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first();
  await more.click();
  await page.waitForTimeout(500);
  const item = page.locator('.digi-dropdown-menu:visible .digi-dropdown-menu-item', { hasText: text }).first();
  console.log(`menu item ${text} count:`, await item.count());
  await item.click();
  await page.waitForTimeout(1500);
}

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

  let index = await waitRow(page, CODE);
  console.log('index:', index, 'before:', JSON.stringify(await rowInfo(page, CODE)));

  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '编辑' }).first().click();
  await page.waitForTimeout(2000);
  const nameInput = page.locator('label[for="biz_type_gen_info.biz_type_name"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('input').first();
  console.log('edit name count:', await nameInput.count(), 'current:', await nameInput.inputValue().catch(() => ''));
  await nameInput.click();
  await nameInput.fill('自动化AP-01-改');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  console.log('after edit body tail:', (await page.evaluate(() => document.body.innerText)).slice(-120));
  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2000);
  console.log('after edit:', JSON.stringify(await rowInfo(page, CODE)));

  index = await waitRow(page, CODE);
  await menuAction(page, index, '失效');
  console.log('after invalidate:', JSON.stringify(await rowInfo(page, CODE)), 'body:', (await page.evaluate(() => document.body.innerText)).slice(-150));

  await page.waitForTimeout(500);
  index = await waitRow(page, CODE);
  await menuAction(page, index, '生效');
  console.log('after activate:', JSON.stringify(await rowInfo(page, CODE)), 'body:', (await page.evaluate(() => document.body.innerText)).slice(-150));

  await page.waitForTimeout(500);
  index = await waitRow(page, CODE);
  await menuAction(page, index, '失效');
  console.log('after invalidate2:', JSON.stringify(await rowInfo(page, CODE)));

  await page.waitForTimeout(500);
  index = await waitRow(page, CODE);
  await menuAction(page, index, '删除');
  const dialog = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return Array.from(document.querySelectorAll('.rc-dialog')).filter(visible).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200))[0];
  });
  console.log('delete dialog:', dialog);
  const confirm = page.locator('.rc-dialog:visible').last().getByRole('button', { name: '确定', exact: true });
  if ((await confirm.count()) > 0) await confirm.click();
  await page.waitForTimeout(2500);
  console.log('after delete exists:', await rowIndex(page, CODE), 'body:', (await page.evaluate(() => document.body.innerText)).slice(-150));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
