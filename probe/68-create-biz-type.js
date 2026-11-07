const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const CODE = process.argv[3];
const NAME = process.argv[4];
const PROP = process.argv[5];
const AUTO = process.argv[6] || '流水码';
if (!TITLE || !CODE || !NAME || !PROP) { console.error('usage: node probe/68-create-biz-type.js <title> <code> <name> <prop> [autoMode]'); process.exit(1); }

async function fill(page, fieldPath, value) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const input = item.locator('input').first();
  await input.click();
  await input.fill('');
  await input.fill(value);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(500);
}

async function select(page, fieldPath, optionText) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  await item.locator('.ath-select').first().click();
  await page.waitForTimeout(500);
  await page.locator('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option:visible').filter({ hasText: new RegExp(`^${optionText}$`) }).last().click();
  await page.waitForTimeout(600);
}

async function dump(page, label) {
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return {
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim()),
      form: Array.from(document.querySelectorAll('[class*="FormItem-module_form-item__"]')).filter(visible).map((item) => ({
        path: item.querySelector('label[for]')?.getAttribute('for'),
        value: item.querySelector('input')?.value,
        select: (item.querySelector('[class*="Select-module_select"]')?.textContent || '').trim().slice(0, 30),
      })),
      bodyTail: (document.body.innerText || '').slice(-300),
    };
  }), null, 2));
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

  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);
  await fill(page, 'biz_type_gen_info.biz_type_no', CODE);
  await fill(page, 'biz_type_gen_info.biz_type_name', NAME);
  await select(page, 'biz_type_gen_info.biz_prop', PROP);
  await select(page, 'biz_type_gen_info.auto_code_mode', AUTO);
  const serl = page.locator('label[for="biz_type_gen_info.serl_digit"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]').locator('input').first();
  if (await serl.isEditable().catch(() => false)) {
    await serl.click();
    await serl.fill('4');
    await page.keyboard.press('Tab');
  }
  await page.waitForTimeout(800);
  await dump(page, 'before-save');

  await page.locator('button:visible', { hasText: '保存' }).first().click();
  await page.waitForTimeout(2500);
  await dump(page, 'after-save');

  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  await page.waitForTimeout(2000);

  const row = await page.evaluate((code) => {
    const r = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).find((x) => (x.querySelector('.ag-cell[col-id="biz_type_no"]')?.textContent || '').trim() === code);
    return r ? { i: r.getAttribute('row-index'), cells: Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()])) } : null;
  }, CODE);
  console.log('created row:', JSON.stringify(row, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
