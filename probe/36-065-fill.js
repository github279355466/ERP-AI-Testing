const { chromium } = require('@playwright/test');

async function findPage() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间信息') return candidate;
  }
  throw new Error('page not found');
}

async function snap(page, label) {
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const panel = Array.from(document.querySelectorAll('.ant-tabs-tabpane')).find((p) => visible(p) && p.querySelector('[class*="FormItem-module_form-item__"]'));
    const value = (path) => {
      const label = document.querySelector(`label[for="${path}"]`);
      const item = label?.closest('[class*="FormItem-module_form-item__"]');
      return item?.querySelector('input')?.value;
    };
    const rows = panel ? Array.from(panel.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter(visible) : [];
    return {
      modalOpen: Array.from(document.querySelectorAll('.rc-dialog-wrap')).some(visible),
      tableNo: value('acctg_perid_info.acctg_perid_table_no'),
      instaCount: value('acctg_perid_info.insta_count'),
      year: value('acctg_perid_info.acctg_year'),
      begin: value('acctg_perid_info.begin_date'),
      tableDisabled: document.querySelector('label[for="acctg_perid_info.acctg_perid_table_no"]')?.closest('[class*="FormItem-module_form-item__"]')?.querySelector('input')?.disabled,
      yearDisabled: document.querySelector('label[for="acctg_perid_info.acctg_year"]')?.closest('[class*="FormItem-module_form-item__"]')?.querySelector('input')?.disabled,
      beginDisabled: document.querySelector('label[for="acctg_perid_info.begin_date"]')?.closest('[class*="FormItem-module_form-item__"]')?.querySelector('input')?.disabled,
      gridRows: rows.length,
      rows: rows.slice(0, 15).map((row) => Object.fromEntries(Array.from(row.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))),
    };
  });
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(info, null, 2));
}

(async () => {
  const page = await findPage();
  await page.bringToFront();

  const modal = page.locator('.rc-dialog-wrap:visible').last();
  if ((await modal.count()) > 0) {
    const confirm = modal.getByRole('button', { name: '确认', exact: true });
    console.log('modal confirm count:', await confirm.count());
    await confirm.last().click();
    await page.waitForTimeout(1600);
  }
  await snap(page, 'after-confirm');

  const yearItem = page.locator('label[for="acctg_perid_info.acctg_year"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const yearInput = yearItem.locator('input').first();
  await yearInput.click();
  await yearInput.fill('');
  await yearInput.fill('2027');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);

  const beginItem = page.locator('label[for="acctg_perid_info.begin_date"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const beginInput = beginItem.locator('input').first();
  await beginInput.click();
  await page.waitForTimeout(600);
  const picker = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return Array.from(document.querySelectorAll('[class*="picker-dropdown"], [class*="Picker"], [class*="calendar"]')).filter(visible).map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300)).slice(0, 3);
  });
  console.log('picker panels:', JSON.stringify(picker));
  await beginInput.fill('2027-01-01');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(1600);
  await snap(page, 'after-begin-typed');

  const save = page.locator('button:visible', { hasText: '保存' }).first();
  console.log('save disabled:', await save.isDisabled().catch(() => null));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
