const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间信息') page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  await page.waitForTimeout(800);
  console.log('tabs:', await page.evaluate(() => Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim())));

  if (!(await page.evaluate(() => document.querySelectorAll('.ant-tabs-tab').length === 1))) {
    const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
    if ((await close.count()) > 0) await close.click();
    await page.waitForTimeout(400);
    const discard = page.getByRole('button', { name: '直接离开', exact: true });
    if ((await discard.count()) > 0) await discard.first().click();
    await page.waitForTimeout(800);
  }

  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1200);

  const form = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return {
      fields: Array.from(document.querySelectorAll('[class*="FormItem-module_form-item__"]')).filter(visible).map((item) => ({
        path: item.querySelector('label[for]')?.getAttribute('for'),
        label: (item.querySelector('[class*="form-item-label-text__"]')?.textContent || '').trim(),
        control: item.querySelector('input, textarea, [class*="WindowSelect"]')?.outerHTML.slice(0, 260),
        value: item.querySelector('input')?.value,
      })),
      buttons: Array.from(document.querySelectorAll('button')).filter(visible).map((b) => ({ text: (b.textContent || '').trim(), disabled: b.disabled })).filter((b) => b.text && b.text !== '...'),
      gridRows: document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length,
    };
  });
  console.log('form:', JSON.stringify(form, null, 2));

  const trigger = page.locator('label[for="acctg_perid_info.acctg_perid_table_no"]:visible').first()
    .locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]')
    .locator('[class*="WindowSelect-module_windowSelect"]').first();
  const box = await trigger.boundingBox();
  console.log('trigger box:', box);
  await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
  await page.waitForTimeout(1500);

  const modal = await page.evaluate(() => {
    const wraps = Array.from(document.querySelectorAll('.rc-dialog-wrap')).filter((el) => el.offsetWidth > 0);
    const wrap = wraps[wraps.length - 1];
    if (!wrap) return null;
    const rows = Array.from(wrap.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).slice(0, 12).map((row) => ({
      index: row.getAttribute('row-index'),
      rowId: row.getAttribute('row-id'),
      cells: Object.fromEntries(Array.from(row.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])),
      radios: row.querySelectorAll('input[type="radio"]').length,
      checkbox: row.querySelectorAll('input[type="checkbox"]').length,
    }));
    return {
      title: (wrap.querySelector('.rc-dialog-title, [class*="modal-title"]')?.textContent || '').trim(),
      headers: Array.from(wrap.querySelectorAll('.ag-header-cell')).map((h) => ({ colId: h.getAttribute('col-id'), text: (h.textContent || '').trim() })),
      rows,
      inputs: Array.from(wrap.querySelectorAll('input')).map((i) => ({ type: i.type, placeholder: i.placeholder, value: i.value, cls: String(i.className).slice(0, 60) })).slice(0, 12),
      buttons: Array.from(wrap.querySelectorAll('button')).map((b) => (b.textContent || '').trim()).filter(Boolean),
      text: (wrap.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    };
  });
  console.log('modal:', JSON.stringify(modal, null, 2));

  const target = modal?.rows?.find((r) => Object.values(r.cells).includes('T064-20261106-B1'));
  console.log('target row:', JSON.stringify(target, null, 2));
  if (target) {
    const rowEl = page.locator('.rc-dialog-wrap:visible .ag-center-cols-container .ag-row[row-index="' + target.index + '"]').last();
    const radio = rowEl.locator('input[type="radio"], input[type="checkbox"]').first();
    if ((await radio.count()) > 0) await radio.click({ force: true });
    else await rowEl.click();
    await page.waitForTimeout(400);
    const confirm = page.getByRole('button', { name: '确定', exact: true });
    console.log('confirm count:', await confirm.count());
    if ((await confirm.count()) > 0) await confirm.last().click();
    await page.waitForTimeout(1500);
  }

  const after = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return {
      modalOpen: Array.from(document.querySelectorAll('.rc-dialog-wrap')).some(visible),
      tableNo: document.querySelector('label[for="acctg_perid_info.acctg_perid_table_no"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
      instaCount: document.querySelector('label[for="acctg_perid_info.insta_count"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
      year: document.querySelector('label[for="acctg_perid_info.acctg_year"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
      begin: document.querySelector('label[for="acctg_perid_info.begin_date"]')?.closest('[class*="form-item__"]')?.querySelector('input')?.value,
      rows: document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length,
      body: (document.body.innerText || '').slice(0, 500),
    };
  });
  console.log('after select:', JSON.stringify(after, null, 2));

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
