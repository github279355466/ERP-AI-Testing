const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const CODE = process.argv[3];
if (!TITLE || !CODE) { console.error('usage: node probe/70-status-flow.js <title> <code>'); process.exit(1); }

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

async function read(page, code) {
  return page.evaluate((value) => {
    const row = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((r) => (r.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === value);
    if (!row) return { exists: false };
    const rowId = row.getAttribute('row-id');
    const right = document.querySelector(`.ag-pinned-right-cols-container .ag-row[row-id="${rowId}"]`);
    return {
      exists: true,
      i: row.getAttribute('row-index'),
      status: (right?.querySelector('.ag-cell[col-id="manage_status"]')?.textContent || '').trim(),
      name: (row.querySelector('.ag-cell[col-id="biz_type_name"]')?.textContent || '').trim(),
      actions: Array.from(right?.querySelectorAll('.custom-op-container:not(.custom-op-measure-container) > button') ?? []).map((b) => (b.textContent || '').trim()).filter(Boolean),
    };
  }, code);
}

async function confirmIfPresent(page) {
  const visible = page.locator('.rc-dialog:visible').last();
  if ((await visible.count()) === 0) return '';
  const text = (await visible.innerText()).replace(/\s+/g, ' ').trim();
  const ok = visible.getByRole('button', { name: '确定', exact: true });
  if ((await ok.count()) > 0) await ok.click();
  await page.waitForTimeout(2200);
  return text;
}

async function menuAction(page, index, text) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const more = page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-more-btn`).first();
  await more.click();
  await page.waitForTimeout(500);
  const item = page.locator('.digi-dropdown-menu:visible .digi-dropdown-menu-item', { hasText: text }).last();
  await item.click();
  await page.waitForTimeout(900);
  const dialog = await confirmIfPresent(page);
  await page.waitForTimeout(1800);
  return dialog;
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

  const initialDialog = await confirmIfPresent(page);
  if (initialDialog) console.log('confirmed pending dialog:', initialDialog);
  console.log('initial:', JSON.stringify(await read(page, CODE)));

  let index = await waitRow(page, CODE);
  console.log('menu 失效:', await menuAction(page, index, '失效'));
  console.log('after 失效:', JSON.stringify(await read(page, CODE)));

  index = await waitRow(page, CODE);
  console.log('menu 生效:', await menuAction(page, index, '生效'));
  console.log('after 生效:', JSON.stringify(await read(page, CODE)));

  index = await waitRow(page, CODE);
  console.log('menu 失效2:', await menuAction(page, index, '失效'));
  console.log('after 失效2:', JSON.stringify(await read(page, CODE)));

  index = await waitRow(page, CODE);
  console.log('menu 删除:', await menuAction(page, index, '删除'));
  console.log('after 删除:', JSON.stringify(await read(page, CODE)));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
