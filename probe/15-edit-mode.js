const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const pages = browser.contexts()[0].pages();
  const page = pages.filter((p) => p.url().includes('lowcode-form-render')).pop();
  if (!page) throw new Error('business page not found');

  const edit = page.locator('button:visible', { hasText: '编辑' }).first();
  if ((await edit.count()) === 0) throw new Error('编辑 button not found');
  await edit.click();
  await page.waitForTimeout(1200);

  const state = await page.evaluate(() => {
    const field = 'ops_unit_invnt_param.aprv_date_basis';
    const label = Array.from(document.querySelectorAll(`label[for="${field}"]`)).find((item) => {
      const wrapper = item.closest('[class*="FormItem-module_form-item__"]');
      return Boolean(wrapper && wrapper.offsetWidth > 0);
    });
    const item = label?.closest('[class*="FormItem-module_form-item__"]');
    const select = item?.querySelector('[class*="Select-module_select__"]');
    const input = select?.querySelector('input');
    return {
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((tab) => (tab.textContent || '').trim()),
      formItems: document.querySelectorAll('[class*="FormItem-module_form-item__"]').length,
      selectClass: select ? String(select.className) : null,
      inputDisabled: input ? input.disabled : null,
      inputReadonly: input ? input.readOnly : null,
      buttons: Array.from(document.querySelectorAll('button'))
        .filter((b) => b.offsetWidth > 0)
        .map((b) => (b.textContent || '').trim())
        .filter(Boolean)
        .slice(0, 30),
    };
  });
  console.log(JSON.stringify(state, null, 2));

  const rect = await page.evaluate(() => {
    const field = 'ops_unit_invnt_param.aprv_date_basis';
    const label = Array.from(document.querySelectorAll(`label[for="${field}"]`)).find((item) => {
      const wrapper = item.closest('[class*="FormItem-module_form-item__"]');
      return Boolean(wrapper && wrapper.offsetWidth > 0);
    });
    const item = label?.closest('[class*="FormItem-module_form-item__"]');
    const select = item?.querySelector('[class*="Select-module_select__"]');
    const box = select?.getBoundingClientRect();
    return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
  });

  if (rect) {
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.waitForTimeout(800);
    const dropdown = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.ath-select-dropdown')).filter((item) => item.offsetWidth > 0);
      return { count: items.length, text: items.map((item) => (item.textContent || '').trim()).join(' | ') };
    });
    console.log(JSON.stringify({ dropdown }, null, 2));
    await page.keyboard.press('Escape');
  }

  const cancel = page.getByRole('button', { name: '取消', exact: true });
  if ((await cancel.count()) > 0) {
    await cancel.first().click();
    console.log('clicked cancel');
  }
  await page.waitForTimeout(600);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) {
    await discard.first().click();
    console.log('clicked discard');
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
