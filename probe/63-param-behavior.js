const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const OPS = process.argv[3] || '000W1';
const BIZ = process.argv[4] || 'AR01';
if (!TITLE) { console.error('usage: node probe/63-param-behavior.js <title> <opsNo> <bizNo>'); process.exit(1); }

async function dump(page, label) {
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const get = (path) => {
      const item = document.querySelector(`label[for="${path}"]`)?.closest('[class*="FormItem-module_form-item__"]');
      if (!item) return null;
      const input = item.querySelector('input');
      const select = item.querySelector('[class*="Select-module_select"]');
      const sw = item.querySelector('button[role="switch"]');
      return {
        text: (item.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
        value: input?.value,
        inputDisabled: input ? input.disabled : null,
        selectText: select ? (select.textContent || '').trim().slice(0, 30) : null,
        selectDisabled: select ? String(select.className).includes('disabled') || Boolean(select.querySelector('.ath-select-disabled')) : null,
        switch: sw ? { checked: sw.getAttribute('aria-checked'), disabled: sw.hasAttribute('disabled') } : null,
      };
    };
    return {
      ops: get('biz_type_ar_param.ops_unit_no') || get('biz_type_ap_param.ops_unit_no'),
      biz: get('biz_type_ar_param.biz_type_no') || get('biz_type_ap_param.biz_type_no'),
      prop: get('biz_type_ar_param.CUS_biz_prop') || get('biz_type_ap_param.CUS_biz_prop'),
      verf: get('biz_type_ar_param.verf_mode') || get('biz_type_ap_param.verf_mode'),
      cashFlag: get('biz_type_ar_param.cash_stlmt_flag') || get('biz_type_ap_param.cash_stlmt_flag'),
      cashNo: get('biz_type_ar_param.cash_stlmt_biz_type_no') || get('biz_type_ap_param.cash_stlmt_biz_type_no'),
      instaNo: get('biz_type_ar_param.insta_offst_adv_biz_type_no') || get('biz_type_ap_param.insta_offst_adv_biz_type_no'),
      autoAprv: get('biz_type_ar_param.creat_is_auto_aprv') || get('biz_type_ap_param.creat_is_auto_aprv'),
      body: (document.body.innerText || '').slice(0, 300),
    };
  });
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(info, null, 2));
}

async function openLookup(page, fieldPath) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const trigger = item.locator('[class*="WindowSelect-module_windowSelect"]').first();
  const box = await trigger.boundingBox();
  await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
  await page.waitForTimeout(1200);
  return page.locator('.rc-dialog-wrap:visible').last();
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === TITLE) page = p;
  }
  if (!page) throw new Error(`page not found: ${TITLE}`);
  await page.bringToFront();
  await page.waitForTimeout(1000);
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);

  const opsModal = await openLookup(page, (TITLE.includes('应付') ? 'biz_type_ap_param' : 'biz_type_ar_param') + '.ops_unit_no');
  console.log('ops modal title:', (await opsModal.locator('[class*="modal-title"]').first().textContent().catch(() => ''))?.trim());
  console.log('ops rows:', await opsModal.locator('.ag-center-cols-container .ag-row[row-index]').count());
  const opsRow = opsModal.locator('.ag-center-cols-container .ag-row[row-index]', { hasText: OPS }).first();
  await opsRow.click();
  await page.waitForTimeout(400);
  await opsModal.getByRole('button', { name: '确认', exact: true }).last().click();
  await page.waitForTimeout(1000);

  const bizModal = await openLookup(page, (TITLE.includes('应付') ? 'biz_type_ap_param' : 'biz_type_ar_param') + '.biz_type_no');
  console.log('biz modal columns:', await bizModal.evaluate((el) => Array.from(el.querySelectorAll('.ag-header-cell')).map((c) => (c.textContent || '').trim()).filter(Boolean)));
  console.log('biz rows:', await bizModal.locator('.ag-center-cols-container .ag-row[row-index]').count());
  const bizRow = bizModal.locator('.ag-center-cols-container .ag-row[row-index]').filter({ hasText: BIZ }).first();
  console.log('biz target count:', await bizRow.count());
  await bizRow.click();
  await page.waitForTimeout(400);
  await bizModal.getByRole('button', { name: '确认', exact: true }).last().click();
  await page.waitForTimeout(1500);
  await dump(page, 'after-select');

  const prefix = TITLE.includes('应付') ? 'biz_type_ap_param' : 'biz_type_ar_param';
  const verfItem = page.locator(`label[for="${prefix}.verf_mode"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const verfSelect = verfItem.locator('.ath-select').first();
  console.log('verf select count:', await verfSelect.count(), 'disabled:', await verfSelect.isDisabled().catch(() => null));
  if ((await verfSelect.count()) > 0 && !(await verfSelect.isDisabled().catch(() => false))) {
    await verfSelect.click();
    await page.waitForTimeout(600);
    console.log('verf options:', JSON.stringify(await page.evaluate(() => Array.from(document.querySelectorAll('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option')).filter((el) => el.offsetWidth > 0).map((el) => (el.textContent || '').trim()))));
    const option = page.locator('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option', { hasText: '分期' }).first();
    if ((await option.count()) > 0) {
      await option.click();
      await page.waitForTimeout(1200);
      await dump(page, 'after-verf-installment');
    } else {
      await page.keyboard.press('Escape');
    }
  }

  await page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first().click().catch(() => undefined);
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
