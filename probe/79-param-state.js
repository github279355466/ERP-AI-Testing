const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
const PREFIX = TITLE.includes('应付') ? 'biz_type_ap_param' : 'biz_type_ar_param';
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
  await page.waitForTimeout(500);

  for (let round = 0; round < 3; round += 1) {
    const dialog = page.locator('.rc-dialog:visible').last();
    if ((await dialog.count()) === 0) break;
    const cancel = dialog.getByRole('button', { name: '取消', exact: true });
    const close = dialog.locator('.rc-dialog-close');
    if ((await cancel.count()) > 0) await cancel.last().click().catch(() => undefined);
    else if ((await close.count()) > 0) await close.first().click().catch(() => undefined);
    await page.waitForTimeout(600);
  }

  const info = await page.evaluate((prefix) => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    const get = (suffix) => {
      const item = document.querySelector(`label[for="${prefix}.${suffix}"]`)?.closest('[class*="FormItem-module_form-item__"]');
      if (!item) return null;
      return {
        text: (item.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        input: item.querySelector('input')?.value,
        select: (item.querySelector('[class*="Select-module_select"]')?.textContent || '').trim().slice(0, 40),
        switch: item.querySelector('button[role="switch"]')?.getAttribute('aria-checked'),
      };
    };
    return {
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim()),
      ops: get('ops_unit_no'),
      biz: get('biz_type_no'),
      prop: get('CUS_biz_prop'),
      verf: get('verf_mode'),
      cash: get('cash_stlmt_flag'),
      cashNo: get('cash_stlmt_biz_type_no'),
      insta: get('insta_offst_adv_biz_type_no'),
      auto: get('creat_is_auto_aprv'),
    };
  }, PREFIX);
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
