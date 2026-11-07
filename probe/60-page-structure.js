const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
if (!TITLE) { console.error('usage: node probe/60-page-structure.js <title>'); process.exit(1); }

async function findListPage(context) {
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) !== TITLE) continue;
    return p;
  }
  throw new Error(`page not found: ${TITLE}`);
}

async function dumpList(page, label) {
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return {
      urlPath: location.pathname,
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').replace(/[\s×]+/g, ' ').trim()),
      columns: Array.from(document.querySelectorAll('.ag-header-cell')).filter(visible).map((c) => ({ colId: c.getAttribute('col-id'), label: (c.textContent || '').trim() })),
      rows: Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible).slice(0, 5).map((r) => ({
        i: r.getAttribute('row-index'),
        cells: Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
      })),
      toolbar: Array.from(document.querySelectorAll('button')).filter(visible).map((b) => ({ text: (b.textContent || '').trim(), disabled: b.disabled })).filter((b) => b.text && b.text !== '...'),
      footer: (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0],
    };
  });
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(info, null, 2));
  return info;
}

async function dumpDetail(page, label) {
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return {
      urlPath: location.pathname,
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').replace(/[\s×]+/g, ' ').trim()),
      fields: Array.from(document.querySelectorAll('[class*="FormItem-module_form-item__"]')).filter(visible).map((item) => {
        const label = item.querySelector('label[for]');
        const input = item.querySelector('input');
        const select = item.querySelector('[class*="Select-module_select"]');
        const win = item.querySelector('[class*="WindowSelect"]');
        const sw = item.querySelector('button[role="switch"]');
        return {
          path: label?.getAttribute('for'),
          label: (item.querySelector('[class*="form-item-label-text__"]')?.textContent || '').trim(),
          required: Boolean(item.querySelector('[class*="form-item-label-required__"]')),
          input: input ? { type: input.type, value: input.value, disabled: input.disabled, readonly: input.readOnly, maxlength: input.getAttribute('maxlength') } : null,
          select: select ? { text: (select.textContent || '').trim().slice(0, 40), disabled: String(select.className).includes('disabled') || Boolean(select.querySelector('.ath-select-disabled')) } : null,
          window: win ? { text: (win.textContent || '').trim().slice(0, 40) } : null,
          switch: sw ? { checked: sw.getAttribute('aria-checked'), disabled: sw.hasAttribute('disabled') } : null,
        };
      }),
      gridHeaders: Array.from(document.querySelectorAll('.ag-header-cell')).filter(visible).map((c) => ({ colId: c.getAttribute('col-id'), label: (c.textContent || '').trim() })),
      gridRows: Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible).length,
      buttons: Array.from(document.querySelectorAll('button')).filter(visible).map((b) => ({ text: (b.textContent || '').trim(), disabled: b.disabled })).filter((b) => b.text && b.text !== '...'),
    };
  });
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(info, null, 2));
  return info;
}

async function enterDetail(context, page, triggerText) {
  const before = new Set(context.pages());
  const button = page.locator('button:visible', { hasText: triggerText }).first();
  await button.click();
  await page.waitForTimeout(2500);
  const created = context.pages().filter((p) => !before.has(p));
  const detail = created.find((p) => p.url().includes('/detail'));
  if (detail) {
    await detail.bringToFront();
    await detail.waitForTimeout(800);
    return { page: detail, ownsPage: true };
  }
  const tab = page.locator('.ant-tabs-tab', { hasText: '详情' }).last();
  if ((await tab.count()) > 0) await tab.click();
  await page.waitForTimeout(800);
  return { page, ownsPage: false };
}

async function leaveDetail(context, listPage, detail, ownsPage) {
  if (ownsPage) {
    await detail.close().catch(() => undefined);
    await listPage.bringToFront();
    await listPage.waitForTimeout(1000);
    return;
  }
  const close = listPage.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await listPage.waitForTimeout(400);
  const discard = listPage.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await listPage.waitForTimeout(800);
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = await findListPage(context);
  await page.bringToFront();
  await page.waitForTimeout(1000);
  await dumpList(page, 'list');

  const created = await enterDetail(context, page, '新增');
  await dumpDetail(created.page, 'new');
  await leaveDetail(context, page, created.page, created.ownsPage);

  await page.waitForTimeout(1500);
  const rowCount = await page.locator('.ag-center-cols-container .ag-row[row-index]').count();
  if (rowCount > 0) {
    const view = await enterDetail(context, page, '查看');
    await dumpDetail(view.page, 'view');
    const edit = view.page.locator('button:visible', { hasText: '编辑' }).first();
    if ((await edit.count()) > 0) {
      await edit.click();
      await view.page.waitForTimeout(1200);
      await dumpDetail(view.page, 'edit');
    }
    await leaveDetail(context, page, view.page, view.ownsPage);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
