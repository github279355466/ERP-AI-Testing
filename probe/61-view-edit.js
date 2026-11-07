const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
if (!TITLE) { console.error('usage: node probe/61-view-edit.js <title>'); process.exit(1); }

async function findPage(context) {
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === TITLE) return p;
  }
  throw new Error(`page not found: ${TITLE}`);
}

async function dump(page, label) {
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return {
      path: location.pathname,
      fields: Array.from(document.querySelectorAll('[class*="FormItem-module_form-item__"]')).filter(visible).map((item) => {
        const label = item.querySelector('label[for]');
        const input = item.querySelector('input');
        const select = item.querySelector('[class*="Select-module_select"]');
        const sw = item.querySelector('button[role="switch"]');
        return {
          path: label?.getAttribute('for'),
          label: (item.querySelector('[class*="form-item-label-text__"]')?.textContent || '').trim(),
          required: Boolean(item.querySelector('[class*="form-item-label-required__"]')),
          value: input?.value,
          disabled: input ? input.disabled : null,
          readonly: input ? input.readOnly : null,
          select: select ? (select.textContent || '').trim().slice(0, 30) : null,
          switch: sw ? { checked: sw.getAttribute('aria-checked'), disabled: sw.hasAttribute('disabled') } : null,
        };
      }),
      buttons: Array.from(document.querySelectorAll('button')).filter(visible).map((b) => ({ text: (b.textContent || '').trim(), disabled: b.disabled })).filter((b) => b.text && b.text !== '...'),
    };
  });
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(info, null, 2));
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = await findPage(context);
  await page.bringToFront();
  await page.waitForTimeout(1500);

  const before = new Set(context.pages());
  await page.locator('button:visible', { hasText: '查看' }).first().click();
  await page.waitForTimeout(2500);
  const created = context.pages().filter((p) => !before.has(p));
  const detail = created.find((p) => p.url().includes('/detail')) ?? page;
  await detail.bringToFront();
  await detail.waitForTimeout(800);
  await dump(detail, 'view');

  const edit = detail.locator('button:visible', { hasText: '编辑' }).first();
  console.log('edit count:', await edit.count());
  if ((await edit.count()) > 0) {
    await edit.click();
    await detail.waitForTimeout(1200);
    await dump(detail, 'edit');
  }

  if (detail !== page) {
    await detail.close();
  } else {
    const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
    if ((await close.count()) > 0) await close.click();
    await page.waitForTimeout(400);
    const discard = page.getByRole('button', { name: '直接离开', exact: true });
    if ((await discard.count()) > 0) await discard.first().click();
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
