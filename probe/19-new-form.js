const { chromium } = require('@playwright/test');

const TITLE = process.argv[2] || '会计期间表';

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const business = [];
  for (const page of context.pages()) {
    if (!page.url().includes('lowcode-form-render')) continue;
    business.push({ page, title: await page.title().catch(() => '') });
  }
  const target = business.find((item) => item.title === TITLE);
  if (!target) throw new Error(`page not found: ${TITLE}`);
  const page = target.page;
  await page.bringToFront();

  const add = page.locator('button:visible', { hasText: '新增' }).first();
  if ((await add.count()) === 0) throw new Error('新增 button not found');
  await add.click();
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll('[class*="FormItem-module_form-item__"]'))
      .filter((item) => item.offsetWidth > 0)
      .map((item) => {
        const label = item.querySelector('label[for]');
        const control = item.querySelector('input, textarea, button, [class*="Select-module_select__"], [class*="WindowSelect-module_windowSelect"]');
        return {
          path: label?.getAttribute('for') ?? null,
          label: (item.querySelector('[class*="form-item-label-text__"]')?.textContent || '').trim(),
          required: Boolean(item.querySelector('[class*="form-item-label-required__"]')),
          tag: control ? control.tagName.toLowerCase() : '',
          cls: control ? String(control.className).slice(0, 140) : '',
          value: control && 'value' in control ? control.value : (control?.textContent || '').trim().slice(0, 80),
          readOnly: control ? Boolean(control.readOnly) : false,
          disabled: control ? Boolean(control.disabled) : false,
          maxLength: control && 'maxLength' in control ? control.maxLength : null,
        };
      });
    const headers = Array.from(document.querySelectorAll('.ag-header-cell[col-id]'))
      .filter((cell) => cell.offsetWidth > 0)
      .map((cell) => ({ colId: cell.getAttribute('col-id'), label: (cell.textContent || '').trim() }));
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'))
      .filter((row) => row.offsetWidth > 0)
      .slice(0, 3)
      .map((row) => {
        const cells = {};
        row.querySelectorAll('.ag-cell[col-id]').forEach((cell) => {
          cells[cell.getAttribute('col-id')] = (cell.textContent || '').trim();
        });
        return { rowIndex: row.getAttribute('row-index'), cells };
      });
    return {
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((tab) => (tab.textContent || '').replace(/[×\s]+/g, ' ').trim()),
      fields,
      headers,
      rowCount: rows.length,
      rows,
      buttons: Array.from(document.querySelectorAll('button'))
        .filter((button) => button.offsetWidth > 0)
        .map((button) => (button.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 30),
    };
  });
  console.log(JSON.stringify(state, null, 2));

  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  const cancel = page.getByRole('button', { name: '取消', exact: true });
  if ((await cancel.count()) > 0) await cancel.first().click();
  await page.waitForTimeout(500);
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
