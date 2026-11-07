const { chromium } = require('@playwright/test');
const NO = 'T064-20261106-A1';

async function findRow(page, no) {
  return page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
    const row = rows.find((r) => {
      const cell = r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]');
      return (cell?.textContent || '').trim() === target;
    });
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, no);
}

async function toastWatch(page, action) {
  await page.evaluate(() => {
    window.__toasts = [];
    const observer = new MutationObserver(() => {
      document.querySelectorAll('[class*="message"], [class*="Message"], [class*="toast"], [class*="Toast"], [role="alert"]').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text && !window.__toasts.includes(text)) window.__toasts.push(text);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await action();
  await page.waitForTimeout(2500);
  return page.evaluate(() => window.__toasts);
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间表') page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(1200);

  let index = await findRow(page, NO);
  console.log('row index:', index);
  if (index < 0) throw new Error('row not found');

  const rowAction = (text) =>
    page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: text });
  await rowAction('编辑').first().click();
  await page.waitForTimeout(1200);
  console.log('after edit click tabs:', await page.evaluate(() => Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim())));
  console.log('save visible:', await page.locator('button:visible', { hasText: '保存' }).count());

  const item = page.locator('label[for="acctg_perid_table.rmk"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const input = item.locator('input').first();
  await input.click();
  await input.fill('自动化写入测试-已编辑');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);

  const toasts = await toastWatch(page, async () => {
    await page.locator('button:visible', { hasText: '保存' }).first().click();
  });
  console.log('save toasts:', JSON.stringify(toasts));

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  console.log('discard guard:', await discard.count());
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(1800);

  const rmk = await page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
    const row = rows.find((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target);
    return row ? (row.querySelector('.ag-cell[col-id="rmk"]')?.textContent || '').trim() : null;
  }, NO);
  console.log('rmk after edit:', rmk);

  index = await findRow(page, NO);
  await rowAction('删除').first().click();
  await page.waitForTimeout(800);
  const dialog = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return Array.from(document.querySelectorAll('[class*="Modal-module"], [class*="Dialog-module"], [role="dialog"]'))
      .filter(visible)
      .map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300),
        buttons: Array.from(el.querySelectorAll('button')).map((b) => (b.textContent || '').trim()).filter(Boolean),
        html: el.outerHTML.slice(0, 600),
      }));
  });
  console.log('delete dialog:', JSON.stringify(dialog, null, 2));

  const confirm = page.getByRole('button', { name: '确定', exact: true });
  const confirmAlt = page.getByRole('button', { name: '确认', exact: true });
  console.log('confirm buttons:', await confirm.count(), await confirmAlt.count());
  const deleteToasts = await toastWatch(page, async () => {
    if ((await confirm.count()) > 0) await confirm.first().click();
    else if ((await confirmAlt.count()) > 0) await confirmAlt.first().click();
  });
  console.log('delete toasts:', JSON.stringify(deleteToasts));
  await page.waitForTimeout(1500);

  const summary = await page.evaluate((target) => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    return {
      rows: rows.length,
      exists: rows.some((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target),
      footer: (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0],
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim()),
    };
  }, NO);
  console.log('after delete:', JSON.stringify(summary, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
