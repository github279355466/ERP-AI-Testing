const { chromium } = require('@playwright/test');
const NO = 'T064-20261106-B1';

async function findPage() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间表') return candidate;
  }
  throw new Error('page not found');
}

async function fill(page, fieldPath, value) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const input = item.locator('input').first();
  await input.click();
  await input.fill('');
  await input.fill(value);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(800);
}

(async () => {
  const page = await findPage();
  await page.bringToFront();
  await page.waitForTimeout(800);
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.__toasts = [];
    new MutationObserver(() => {
      document.querySelectorAll('[class*="message"], [class*="Message"], [role="alert"]').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text && !window.__toasts.includes(text)) window.__toasts.push(text);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  await fill(page, 'acctg_perid_table.acctg_perid_table_no', NO);
  await fill(page, 'acctg_perid_table.acctg_perid_table_name', '自动化测试-13期-B1');
  await fill(page, 'acctg_perid_table.insta_count', '13');

  const state = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    const last = rows[rows.length - 1];
    const sw = last?.querySelector('button[role="switch"]');
    return {
      rows: rows.length,
      last: last ? {
        seq: (last.querySelector('.ag-cell[col-id="seq"]')?.textContent || '').trim(),
        no: (last.querySelector('.ag-cell[col-id="acctg_perid_no"]')?.textContent || '').trim(),
        checked: sw?.getAttribute('aria-checked'),
        disabled: sw?.hasAttribute('disabled'),
      } : null,
      firstSwitch: rows[0]?.querySelector('button[role="switch"]')?.getAttribute('aria-checked'),
      toasts: window.__toasts,
      saveDisabled: Array.from(document.querySelectorAll('button')).filter((b) => visible(b) && (b.textContent || '').trim() === '保存').map((b) => b.disabled),
      inputValue: document.querySelector('input.input-number-input')?.value,
    };
  });
  console.log(JSON.stringify(state, null, 2));

  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  console.log('toasts after save:', JSON.stringify(await page.evaluate(() => window.__toasts)));

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2000);

  const row = await page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
    const found = rows.find((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target);
    return found ? {
      index: found.getAttribute('row-index'),
      cells: Object.fromEntries(Array.from(found.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
    } : null;
  }, NO);
  console.log('created row:', JSON.stringify(row, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
