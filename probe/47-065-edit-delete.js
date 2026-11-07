const { chromium } = require('@playwright/test');
const NO = 'T064-20261106-B1';

async function listPage(context) {
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('/list')) continue;
    if (!candidate.url().includes('workItemCode=hoRpQwPEmnlK')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间信息') return candidate;
  }
  throw new Error('065 list page not found');
}

async function findRow(page, no) {
  return page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
    const row = rows.find((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target);
    return row ? Number(row.getAttribute('row-index')) : -1;
  }, no);
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const page = await listPage(context);
  await page.bringToFront();
  await page.waitForTimeout(1200);
  console.log('pages before:', context.pages().map((p) => p.url().split('?')[0]));

  let index = await findRow(page, NO);
  console.log('index:', index);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '编辑' }).first().click();
  await page.waitForTimeout(2500);
  console.log('pages after:', context.pages().map((p) => p.url().split('?')[0]));
  console.log('tabs on list page:', await page.evaluate(() => Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim())));

  let editPage = page;
  for (const candidate of context.pages()) {
    if (candidate === page) continue;
    if (candidate.url().includes('/detail') && candidate.url().includes('workItemCode=hoRpQwPEmnlK')) editPage = candidate;
  }
  if (editPage === page) {
    const detailTab = page.locator('.ant-tabs-tab', { hasText: '详情' }).first();
    if ((await detailTab.count()) > 0) await detailTab.click();
  } else {
    await editPage.bringToFront();
  }
  await page.waitForTimeout(1000);
  console.log('edit page url:', editPage.url().split('?')[0]);
  console.log('edit page fields:', await editPage.evaluate(() => ({
    table: (document.querySelector('label[for="acctg_perid_info.acctg_perid_table_no"]')?.closest('[class*="form-item__"]')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    year: document.querySelector('label[for="acctg_perid_info.acctg_year"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
    begin: document.querySelector('label[for="acctg_perid_info.begin_date"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
    rmk: document.querySelector('label[for="acctg_perid_info.rmk"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
    rows: document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length,
  })));

  const rmkItem = editPage.locator('label[for="acctg_perid_info.rmk"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const rmkInput = rmkItem.locator('input').first();
  await rmkInput.click();
  await rmkInput.fill('自动化写入测试-065-已编辑');
  await editPage.keyboard.press('Tab');
  await editPage.waitForTimeout(400);

  await editPage.evaluate(() => {
    window.__toasts = [];
    new MutationObserver(() => {
      document.querySelectorAll('[class*="message"], [class*="Message"], [role="alert"]').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text && !window.__toasts.includes(text)) window.__toasts.push(text);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await editPage.locator('button:visible', { hasText: '保存' }).first().click();
  await editPage.waitForTimeout(3000);
  console.log('edit toasts:', JSON.stringify(await editPage.evaluate(() => window.__toasts)));

  if (editPage !== page) {
    await editPage.close();
  } else {
    const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
    if ((await close.count()) > 0) await close.click();
    const discard = page.getByRole('button', { name: '直接离开', exact: true });
    if ((await discard.count()) > 0) await discard.first().click();
  }
  await page.waitForTimeout(2500);

  const rmk = await page.evaluate((target) => {
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
    const row = rows.find((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target);
    return row ? (row.querySelector('.ag-cell[col-id="rmk"]')?.textContent || '').trim() : null;
  }, NO);
  console.log('rmk after edit:', rmk);

  index = await findRow(page, NO);
  await page.locator(`.ag-row[row-index="${index}"] .custom-op-container:not(.custom-op-measure-container) > button.custom-op-text-btn`, { hasText: '删除' }).first().click();
  await page.waitForTimeout(1000);
  console.log('dialog:', await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return Array.from(document.querySelectorAll('.rc-dialog')).filter(visible).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200))[0];
  }));
  await page.evaluate(() => {
    window.__toasts = [];
    new MutationObserver(() => {
      document.querySelectorAll('[class*="message"], [class*="Message"], [role="alert"]').forEach((el) => {
        const text = (el.textContent || '').trim();
        if (text && !window.__toasts.includes(text)) window.__toasts.push(text);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.locator('.rc-dialog:visible').last().getByRole('button', { name: '确定', exact: true }).click();
  await page.waitForTimeout(3000);
  console.log('delete toasts:', JSON.stringify(await page.evaluate(() => window.__toasts)));
  console.log('after delete:', JSON.stringify(await page.evaluate((target) => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible);
    return {
      rows: rows.length,
      exists: rows.some((r) => (r.querySelector('.ag-cell[col-id="acctg_perid_table_no"]')?.textContent || '').trim() === target),
      footer: (document.body.innerText.match(/共\s*\d+\s*条/) || [''])[0],
    };
  }, NO), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
