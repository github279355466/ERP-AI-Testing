const { chromium } = require('@playwright/test');

async function findPage(title) {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === title) return candidate;
  }
  throw new Error(`page not found: ${title}`);
}

async function describe(page, label) {
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return {
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').replace(/[\s]+/g, ' ').trim()),
      toolbar: Array.from(document.querySelectorAll('button')).filter(visible).map((b) => ({
        text: (b.textContent || '').trim(),
        cls: String(b.className).slice(0, 120),
        disabled: b.disabled,
      })).filter((b) => b.text),
      rows: Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible).slice(0, 3).map((row) => ({
        index: row.getAttribute('row-index'),
        rowId: row.getAttribute('row-id'),
        text: (row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        buttons: Array.from(row.querySelectorAll('button')).map((b) => (b.textContent || '').trim()).filter(Boolean),
      })),
      checkboxes: document.querySelectorAll('.ag-center-cols-container input[type="checkbox"]').length,
      headerCheckbox: Boolean(document.querySelector('.ag-header input[type="checkbox"]')),
    };
  });
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(info, null, 2));
}

(async () => {
  const page = await findPage('会计期间表');
  await page.bringToFront();
  await describe(page, 'list');

  const add = page.locator('button:visible', { hasText: '新增' }).first();
  await add.click();
  await page.waitForTimeout(1200);
  await describe(page, 'new-form');

  const save = page.locator('button:visible', { hasText: '保存' }).first();
  console.log('save button count:', await page.locator('button:visible', { hasText: '保存' }).count(), 'visible:', await save.isVisible().catch(() => false));

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(600);

  const view = page.locator('button:visible', { hasText: '查看' }).first();
  await view.click();
  await page.waitForTimeout(1200);
  await describe(page, 'view-form');

  const edit = page.locator('button:visible', { hasText: '编辑' }).first();
  console.log('edit button count:', await page.locator('button:visible', { hasText: '编辑' }).count());
  if ((await edit.count()) > 0) {
    await edit.click();
    await page.waitForTimeout(1000);
    await describe(page, 'edit-form');
  }

  const close2 = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close2.count()) > 0) await close2.click();
  await page.waitForTimeout(400);
  const discard2 = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard2.count()) > 0) await discard2.first().click();
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
